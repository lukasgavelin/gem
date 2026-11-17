import { WORLD_DATA } from './levels.js';
import { BookWorld } from './book.js';
import { PaperclipPlayer } from './player.js';
import { sound } from './audio.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

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

let viewW = window.innerWidth;
let viewH = window.innerHeight;

function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// World & Player
const world = new BookWorld();
const player = new PaperclipPlayer();

// Camera state in world coordinates
let camX = 4;
let camY = -1;

// Game state
let starsCollected = 0;
let deaths = 0;
let runTime = 0;
let worldTime = 0;
let gameStarted = false;
let gameWon = false;
let paused = false;

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
    world.update(worldTime, dt);
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

  // Smooth 2D sidescrolling camera with lookahead
  const lookAhead = player.facing * 2.4;
  const targetCamX = Math.max(4, Math.min(396, player.x + lookAhead));
  const targetCamY = Math.max(-1.6, Math.min(2.2, player.y * 0.4));

  camX += (targetCamX - camX) * Math.min(1, dt * 5.2);
  camY += (targetCamY - camY) * Math.min(1, dt * 4.2);

  // Render pure 2D boiling pencil world & character
  world.draw(ctx, camX, camY, viewW, viewH, worldTime);
  player.draw(ctx, camX, camY, viewW, viewH, worldTime);
}

requestAnimationFrame(animate);
