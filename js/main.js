import * as THREE from 'three';
import { WORLD_DATA } from './levels.js';
import { BookWorld } from './book.js';
import { PaperclipPlayer } from './player.js';
import { sound } from './audio.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x141c26);

const camera = new THREE.PerspectiveCamera(
  38,
  window.innerWidth / window.innerHeight,
  0.5,
  80
);
camera.position.set(4, -0.5, 16.5);

// Warm desk-lamp lighting + bright paper ambient fill (Three.js r155+ PBR units)
const ambientLight = new THREE.AmbientLight(0xffffff, 2.8);
scene.add(ambientLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.5);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
dirLight.position.set(8, 10, 12);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 35;
dirLight.shadow.camera.left = -18;
dirLight.shadow.camera.right = 18;
dirLight.shadow.camera.top = 12;
dirLight.shadow.camera.bottom = -12;
dirLight.shadow.bias = -0.0005;
scene.add(dirLight);
scene.add(dirLight.target);

const hud = document.getElementById('hud');
const levelNameEl = document.getElementById('level-name');
const starCountEl = document.getElementById('star-count');
const progressPctEl = document.getElementById('progress-pct');
const runTimerEl = document.getElementById('run-timer');
const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const winOverlay = document.getElementById('win-overlay');
const winStatsEl = document.getElementById('win-stats');
const winBestEl = document.getElementById('win-best');
const btnStart = document.getElementById('btn-start');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnCheckpoint = document.getElementById('btn-checkpoint');
const btnFullRestart = document.getElementById('btn-full-restart');
const btnRestart = document.getElementById('btn-restart');
const btnMute = document.getElementById('btn-mute');

const BEST_TIME_KEY = 'gemmets_resa_best_time';
const BEST_STARS_KEY = 'gemmets_resa_best_stars';

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// World & Player
const world = new BookWorld(scene);
const player = new PaperclipPlayer(scene);

// Camera state in world coordinates
let camX = 4;
let camY = -1;

// Game state
let starsCollected = 0;
let deaths = 0;
let runTime = 0;
let worldTime = 0;
let dimensionMix = 0;
let gameStarted = false;
let gameWon = false;
let paused = false;

function computeTargetDimension() {
  if (player.dead) return 0;
  // Automatic chapter progression across the 1200-unit book:
  // Ch 1 (0..300):   0.00 -> 0.14 (2D notebook)
  // Ch 2 (300..600): 0.35 -> 0.58 (2.5D math drafting)
  // Ch 3 (600..900): 0.68 -> 0.85 (3D lab & glass)
  // Ch 4 (900..1200): 0.92 -> 1.00 (Full 3D papercraft finale)
  const goalX = WORLD_DATA.goal.x || 1200;
  const t = Math.max(0, Math.min(1, player.x / goalX));
  let base = 0;
  if (t < 0.25) {
    base = (t / 0.25) * 0.14;
  } else if (t < 0.5) {
    base = 0.35 + ((t - 0.25) / 0.25) * 0.23;
  } else if (t < 0.75) {
    base = 0.68 + ((t - 0.5) / 0.25) * 0.17;
  } else {
    base = 0.92 + Math.min(1, (t - 0.75) / 0.1) * 0.08;
  }

  // Subtle kinetic pop-out during dash or high-speed bounce
  const kineticBoost = player.dashTimer > 0 ? 0.32 : Math.abs(player.vy) > 16 ? 0.2 : 0;
  return Math.min(1, base + kineticBoost);
}

// Input state
const keys = new Set();
const touchState = { left: false, right: false, jumpHeld: false };
let jumpJustPressed = false;
let dashJustPressed = false;

function formatTime(sec) {
  const total = Math.max(0, Math.floor(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function setPaused(nextPaused) {
  if (!gameStarted || gameWon) return;
  paused = nextPaused;
  pauseOverlay.classList.toggle('hidden', !paused);
  btnPause.textContent = paused ? '▶ Fortsätt' : '⏸ Paus';
}

function togglePause() {
  setPaused(!paused);
}

function respawnAtCheckpoint() {
  if (!gameStarted || gameWon) return;
  player.spawn(player.spawnPos);
  camX = player.x + 2.5;
  camY = Math.max(-1.6, Math.min(2.2, player.y * 0.4));
  setPaused(false);
  updateHUD();
}

window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(code)) {
    e.preventDefault();
  }
  if (!keys.has(code)) {
    if (code === 'Space' || code === 'KeyW' || code === 'ArrowUp') {
      jumpJustPressed = true;
    }
    if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyX' || code === 'KeyK') {
      dashJustPressed = true;
    }
    if (code === 'KeyP' || code === 'Escape') {
      togglePause();
    }
    if (code === 'KeyR' && gameStarted && !gameWon) {
      if (e.shiftKey) {
        resetWorld();
      } else {
        respawnAtCheckpoint();
      }
    }
    if (code === 'KeyM') {
      toggleMute();
    }
  }
  keys.add(code);
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

// Touch controls binding
function bindTouchHold(el, keyName) {
  if (!el) return;
  const start = (e) => {
    e.preventDefault();
    touchState[keyName] = true;
    el.classList.add('active');
    if (keyName === 'jumpHeld') jumpJustPressed = true;
  };
  const end = (e) => {
    e.preventDefault();
    touchState[keyName] = false;
    el.classList.remove('active');
  };
  el.addEventListener('pointerdown', start);
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', end);
}

bindTouchHold(document.getElementById('touch-left'), 'left');
bindTouchHold(document.getElementById('touch-right'), 'right');
bindTouchHold(document.getElementById('touch-jump'), 'jumpHeld');

const touchDashBtn = document.getElementById('touch-dash');
if (touchDashBtn) {
  touchDashBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dashJustPressed = true;
    touchDashBtn.classList.add('active');
  });
  const clearDash = () => touchDashBtn.classList.remove('active');
  touchDashBtn.addEventListener('pointerup', clearDash);
  touchDashBtn.addEventListener('pointercancel', clearDash);
}

function toggleMute() {
  const muted = sound.toggleMute();
  btnMute.textContent = muted ? '🔇 Tyst' : '🔊 Ljud';
}

function updateHUD() {
  let secName = WORLD_DATA.sections[0].name;
  for (const s of WORLD_DATA.sections) {
    if (player.x >= s.startX) secName = s.name;
  }
  levelNameEl.textContent = secName;
  starCountEl.textContent = `${starsCollected} / ${WORLD_DATA.stars.length}`;

  const pct = Math.max(
    0,
    Math.min(
      100,
      Math.round(((player.x - WORLD_DATA.spawn.x) / (WORLD_DATA.goal.x - WORLD_DATA.spawn.x)) * 100)
    )
  );
  progressPctEl.textContent = `${pct}%`;
  runTimerEl.textContent = formatTime(runTime);
}

function resetWorld() {
  starsCollected = 0;
  deaths = 0;
  runTime = 0;
  worldTime = 0;
  dimensionMix = 0;
  gameWon = false;
  paused = false;
  pauseOverlay.classList.add('hidden');
  btnPause.textContent = '⏸ Paus';
  world.loadWorld(WORLD_DATA);
  player.spawn(WORLD_DATA.spawn);
  camX = player.x + 2.5;
  camY = -0.8;
  updateHUD();
}

function triggerVictory() {
  if (gameWon) return;
  gameWon = true;
  sound.playPageFlip();

  let bestTime = Number(localStorage.getItem(BEST_TIME_KEY) || Infinity);
  let bestStars = Number(localStorage.getItem(BEST_STARS_KEY) || 0);
  if (runTime < bestTime) {
    bestTime = runTime;
    localStorage.setItem(BEST_TIME_KEY, bestTime.toFixed(1));
  }
  if (starsCollected > bestStars) {
    bestStars = starsCollected;
    localStorage.setItem(BEST_STARS_KEY, String(bestStars));
  }

  winStatsEl.textContent = `Du samlade ${starsCollected} av ${WORLD_DATA.stars.length} stjärnor på ${formatTime(runTime)} (${deaths} omstarter)!`;
  winBestEl.textContent = `Personbästa: ${formatTime(bestTime)} • Flest stjärnor: ${bestStars} / ${WORLD_DATA.stars.length}`;
  winOverlay.classList.remove('hidden');
}

resetWorld();

btnStart.addEventListener('click', () => {
  sound.init();
  sound.playPageFlip();
  startOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  gameStarted = true;
});

btnPlayAgain.addEventListener('click', () => {
  sound.init();
  sound.playPageFlip();
  winOverlay.classList.add('hidden');
  resetWorld();
  gameStarted = true;
});

btnPause.addEventListener('click', togglePause);
btnResume.addEventListener('click', () => setPaused(false));
btnCheckpoint.addEventListener('click', respawnAtCheckpoint);
btnFullRestart.addEventListener('click', resetWorld);
btnRestart.addEventListener('click', () => {
  if (gameStarted && !gameWon) {
    resetWorld();
  }
});
btnMute.addEventListener('click', toggleMute);

// Main loop
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (!paused) {
    worldTime += dt;
    const targetDim = computeTargetDimension();
    const dimSpeed = player.dead ? 10 : 3.2;
    dimensionMix += (targetDim - dimensionMix) * Math.min(1, dt * dimSpeed);
    world.update(worldTime, dt, dimensionMix);
  }

  if (gameStarted && !gameWon && !paused) {
    runTime += dt;
    const input = {
      left: keys.has('KeyA') || keys.has('ArrowLeft') || touchState.left,
      right: keys.has('KeyD') || keys.has('ArrowRight') || touchState.right,
      up: keys.has('KeyW') || keys.has('ArrowUp'),
      jumpPressed: jumpJustPressed,
      jumpHeld: keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp') || touchState.jumpHeld,
      dashPressed: dashJustPressed,
    };

    const result = player.update(dt, input, world);
    if (result.starsCollectedNow > 0) {
      starsCollected += result.starsCollectedNow;
    }
    if (result.died) {
      deaths += 1;
    }
    updateHUD();
    if (result.reachedGoal) {
      triggerVictory();
    }
  } else if (!paused) {
    player.updateParticles(dt);
  }

  jumpJustPressed = false;
  dashJustPressed = false;

  // Smooth 2.5D dolly-zoom camera: constant visible height (11.36 units at z = 0)
  const fov = 10 + 28 * dimensionMix;
  const camZ = 11.36 / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.far = camZ + 50;
    camera.updateProjectionMatrix();
  }

  const lookAhead = player.facing * 2.4;
  const targetCamX = Math.max(4, Math.min(WORLD_DATA.goal.x - 4, player.x + lookAhead));
  const targetCamY = Math.max(-1.6, Math.min(2.2, player.y * 0.4));

  camX += (targetCamX - camX) * Math.min(1, dt * 5.2);
  camY += (targetCamY - camY) * Math.min(1, dt * 4.2);

  camera.position.set(camX, camY + 0.35 * dimensionMix, camZ);
  camera.lookAt(camX + player.facing * 0.35 * dimensionMix, camY, 0);

  // Dynamic 2D flat lighting -> 3D desk-lamp shadows
  ambientLight.intensity = 2.8 - 1.2 * dimensionMix;
  hemiLight.intensity = 0.5 + 0.5 * dimensionMix;
  dirLight.intensity = 2.2 * dimensionMix;
  renderer.shadowMap.enabled = dimensionMix > 0.05;

  // Keep directional shadow frustum centered on camera
  dirLight.position.set(camX + 5, camY + 9, 12);
  dirLight.target.position.set(camX, camY, 0);
  dirLight.target.updateMatrixWorld();

  player.syncVisuals(worldTime, dimensionMix);
  renderer.render(scene, camera);
}

requestAnimationFrame(animate);
