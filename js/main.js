import * as THREE from 'three';
import { WORLD_DATA } from './levels.js';
import { BookWorld } from './book.js';
import { PaperclipPlayer } from './player.js';
import { sound } from './audio.js';

const isMobile = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 820;
const maxDpr = isMobile ? 1.5 : 2;
const shadowRes = isMobile ? 1024 : 2048;

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
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
dirLight.shadow.mapSize.set(shadowRes, shadowRes);
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
const chapterBannerEl = document.getElementById('chapter-banner');
const startOverlay = document.getElementById('start-overlay');
const pauseOverlay = document.getElementById('pause-overlay');
const winOverlay = document.getElementById('win-overlay');
const winStatsEl = document.getElementById('win-stats');
const winBestEl = document.getElementById('win-best');
const btnStart = document.getElementById('btn-start');
const btnResumeSaved = document.getElementById('btn-resume-saved');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnCheckpoint = document.getElementById('btn-checkpoint');
const btnFullRestart = document.getElementById('btn-full-restart');
const btnRestart = document.getElementById('btn-restart');
const btnMute = document.getElementById('btn-mute');
const btnMutePause = document.getElementById('btn-mute-pause');
const btnFullscreen = document.getElementById('btn-fullscreen');
const rotateHint = document.getElementById('rotate-hint');
const btnDismissRotate = document.getElementById('btn-dismiss-rotate');
const btnClearCacheStart = document.getElementById('btn-clear-cache-start');
const btnClearCachePause = document.getElementById('btn-clear-cache-pause');
const chapterButtons = document.querySelectorAll('.chapter-btn');

async function clearAppCache() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // Ignore storage/cache errors in restricted contexts
  }
  const url = new URL(window.location.href);
  url.searchParams.set('v', String(Date.now()));
  window.location.replace(url.toString());
}

const BEST_TIME_KEY = 'gemmets_resa_best_time';
const BEST_STARS_KEY = 'gemmets_resa_best_stars';
const SAVE_STATE_KEY = 'gemmets_resa_save_state';
const CHAPTER_STARS_KEY = 'gemmets_resa_chapter_stars';
const GHOST_KEY = 'gemmets_resa_best_ghost';

function resizeCanvas() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
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
let cameraTrauma = 0;

// Game state
let starsCollected = 0;
let deaths = 0;
let runTime = 0;
let worldTime = 0;
let dimensionMix = 0;
let gameStarted = false;
let gameWon = false;
let paused = false;
let currentChapterIdx = 0;
let isFullRun = true;

// Ghost replay state
let ghostSamples = [];
let ghostSampleTimer = 0;
let activeGhost = null;

// Chapter banner timers
let bannerFadeTimer = null;
let bannerHideTimer = null;

function getChapterIndexForX(x) {
  if (x >= 900) return 3;
  if (x >= 600) return 2;
  if (x >= 300) return 1;
  return 0;
}

function showBanner(text, duration = 2.6) {
  if (!chapterBannerEl) return;
  if (bannerFadeTimer) clearTimeout(bannerFadeTimer);
  if (bannerHideTimer) clearTimeout(bannerHideTimer);

  chapterBannerEl.textContent = text;
  chapterBannerEl.classList.remove('hidden', 'fade-out');

  bannerFadeTimer = setTimeout(() => {
    chapterBannerEl.classList.add('fade-out');
  }, Math.max(200, (duration - 0.25) * 1000));

  bannerHideTimer = setTimeout(() => {
    chapterBannerEl.classList.add('hidden');
    chapterBannerEl.classList.remove('fade-out');
  }, duration * 1000);
}

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function loadChapterStars() {
  const arr = readJsonStorage(CHAPTER_STARS_KEY, [0, 0, 0, 0]);
  return Array.isArray(arr) && arr.length === 4 ? arr : [0, 0, 0, 0];
}

function updateChapterStarsProgress() {
  const counts = [0, 0, 0, 0];
  for (const s of world.stars) {
    if (s.collected) {
      counts[getChapterIndexForX(s.x)] += 1;
    }
  }
  const best = loadChapterStars();
  let changed = false;
  for (let i = 0; i < 4; i++) {
    if (counts[i] > best[i]) {
      best[i] = counts[i];
      changed = true;
    }
  }
  if (changed) {
    writeJsonStorage(CHAPTER_STARS_KEY, best);
    refreshChapterUI();
  }
}

function refreshChapterUI() {
  const best = loadChapterStars();
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`ch-stars-${i}`);
    if (el) el.textContent = `★ ${best[i] || 0}/12`;
  }
}

function saveMidRunState() {
  if (!gameStarted || gameWon) return;
  const activeCheckpoints = [];
  world.checkpoints.forEach((cp, idx) => {
    if (cp.activated) activeCheckpoints.push(idx);
  });
  const collectedStarIndices = [];
  world.stars.forEach((s, idx) => {
    if (s.collected) collectedStarIndices.push(idx);
  });
  writeJsonStorage(SAVE_STATE_KEY, {
    spawnPos: player.spawnPos,
    activeCheckpoints,
    collectedStarIndices,
    runTime,
    deaths,
    isFullRun,
  });
}

function clearSavedRun() {
  try {
    localStorage.removeItem(SAVE_STATE_KEY);
  } catch {
    // Ignore storage errors
  }
  if (btnResumeSaved) btnResumeSaved.classList.add('hidden');
}

function refreshResumeButton() {
  if (!btnResumeSaved) return;
  const save = readJsonStorage(SAVE_STATE_KEY, null);
  if (save && save.spawnPos && typeof save.spawnPos.x === 'number') {
    const pct = Math.max(
      0,
      Math.min(
        100,
        Math.round(((save.spawnPos.x - WORLD_DATA.spawn.x) / (WORLD_DATA.goal.x - WORLD_DATA.spawn.x)) * 100)
      )
    );
    const chNum = getChapterIndexForX(save.spawnPos.x) + 1;
    btnResumeSaved.textContent = `Fortsätt (Kap. ${chNum} • ${pct}%)`;
    btnResumeSaved.classList.remove('hidden');
  } else {
    btnResumeSaved.classList.add('hidden');
  }
}

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
const touchState = { left: false, right: false, up: false, jumpHeld: false, dashUp: false };
let jumpJustPressed = false;
let dashJustPressed = false;

// Gamepad state & haptics
const padPrev = { jump: false, dash: false, pause: false, checkpoint: false };

function pollGamepad() {
  const result = { left: false, right: false, up: false, jumpHeld: false };
  if (!navigator.getGamepads) return result;

  const pads = navigator.getGamepads();
  let gp = null;
  for (const p of pads) {
    if (p && p.connected) {
      gp = p;
      break;
    }
  }
  if (!gp) {
    padPrev.jump = false;
    padPrev.dash = false;
    padPrev.pause = false;
    padPrev.checkpoint = false;
    return result;
  }

  const ax = gp.axes[0] || 0;
  const ay = gp.axes[1] || 0;
  result.left = ax < -0.35 || Boolean(gp.buttons[14]?.pressed);
  result.right = ax > 0.35 || Boolean(gp.buttons[15]?.pressed);
  result.up = ay < -0.45 || Boolean(gp.buttons[12]?.pressed);
  result.jumpHeld = Boolean(gp.buttons[0]?.pressed || gp.buttons[1]?.pressed);

  const dashHeld = Boolean(gp.buttons[2]?.pressed || gp.buttons[5]?.pressed || gp.buttons[7]?.pressed);
  const pauseHeld = Boolean(gp.buttons[9]?.pressed);
  const checkpointHeld = Boolean(gp.buttons[8]?.pressed || gp.buttons[3]?.pressed);

  if (result.jumpHeld && !padPrev.jump) jumpJustPressed = true;
  if (dashHeld && !padPrev.dash) dashJustPressed = true;
  if (pauseHeld && !padPrev.pause) togglePause();
  if (checkpointHeld && !padPrev.checkpoint && gameStarted && !gameWon) respawnAtCheckpoint();

  padPrev.jump = result.jumpHeld;
  padPrev.dash = dashHeld;
  padPrev.pause = pauseHeld;
  padPrev.checkpoint = checkpointHeld;
  return result;
}

function triggerHaptic(ms, weak = 0.3, strong = 0.5) {
  try {
    if (navigator.getGamepads) {
      const pads = navigator.getGamepads();
      for (const gp of pads) {
        if (gp && gp.connected && gp.vibrationActuator && gp.vibrationActuator.playEffect) {
          gp.vibrationActuator
            .playEffect('dual-rumble', {
              startDelay: 0,
              duration: ms,
              weakMagnitude: weak,
              strongMagnitude: strong,
            })
            .catch(() => {});
          return;
        }
      }
    }
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  } catch {
    // Ignore unsupported haptic hardware
  }
}

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
  btnPause.textContent = paused ? '▶ Fortsätt' : '⏸ Meny';
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

// Touch controls binding (thumb-slide 2D D-pad + jump/dash buttons)
const touchDpad = document.getElementById('touch-dpad');
const touchLeftBtn = document.getElementById('touch-left');
const touchRightBtn = document.getElementById('touch-right');
let dpadPointerId = null;

function updateDpadFromPoint(clientX, clientY) {
  if (!touchDpad) return;
  const rect = touchDpad.getBoundingClientRect();
  const midX = rect.left + rect.width / 2;
  const goLeft = clientX < midX;
  const goUp = clientY < rect.top + rect.height * 0.38;
  touchState.left = goLeft;
  touchState.right = !goLeft;
  touchState.up = goUp;
  if (touchLeftBtn) touchLeftBtn.classList.toggle('active', goLeft);
  if (touchRightBtn) touchRightBtn.classList.toggle('active', !goLeft);
  touchDpad.classList.toggle('up-active', goUp);
}

function clearDpad() {
  dpadPointerId = null;
  touchState.left = false;
  touchState.right = false;
  touchState.up = false;
  if (touchLeftBtn) touchLeftBtn.classList.remove('active');
  if (touchRightBtn) touchRightBtn.classList.remove('active');
  if (touchDpad) touchDpad.classList.remove('up-active');
}

if (touchDpad) {
  touchDpad.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dpadPointerId = e.pointerId;
    if (touchDpad.setPointerCapture) {
      try {
        touchDpad.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if capture is unavailable
      }
    }
    updateDpadFromPoint(e.clientX, e.clientY);
  });
  touchDpad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dpadPointerId) return;
    e.preventDefault();
    updateDpadFromPoint(e.clientX, e.clientY);
  });
  touchDpad.addEventListener('pointerup', (e) => {
    if (e.pointerId === dpadPointerId) clearDpad();
  });
  touchDpad.addEventListener('pointercancel', (e) => {
    if (e.pointerId === dpadPointerId) clearDpad();
  });
}

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

bindTouchHold(document.getElementById('touch-jump'), 'jumpHeld');

const touchDashBtn = document.getElementById('touch-dash');
let dashPointerId = null;
let dashStartY = 0;
if (touchDashBtn) {
  touchDashBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dashPointerId = e.pointerId;
    dashStartY = e.clientY;
    const rect = touchDashBtn.getBoundingClientRect();
    touchState.dashUp = touchState.jumpHeld || e.clientY < rect.top + rect.height * 0.45;
    dashJustPressed = true;
    touchDashBtn.classList.add('active');
  });
  touchDashBtn.addEventListener('pointermove', (e) => {
    if (e.pointerId !== dashPointerId) return;
    if (e.clientY < dashStartY - 12) {
      touchState.dashUp = true;
    }
  });
  const clearDash = (e) => {
    if (e.pointerId === dashPointerId || e.type === 'pointercancel') {
      dashPointerId = null;
      touchDashBtn.classList.remove('active');
    }
  };
  touchDashBtn.addEventListener('pointerup', clearDash);
  touchDashBtn.addEventListener('pointercancel', clearDash);
}

function syncMuteLabels() {
  const label = sound.muted ? '🔇 Tyst' : '🔊 Ljud';
  btnMute.textContent = label;
  if (btnMutePause) btnMutePause.textContent = label;
}

function toggleMute() {
  sound.toggleMute();
  syncMuteLabels();
}

function tryLockLandscape() {
  if (screen.orientation && screen.orientation.lock) {
    screen.orientation.lock('landscape').catch(() => {});
  }
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      tryLockLandscape();
    } else {
      await document.exitFullscreen();
    }
  } catch {
    // Fullscreen can be blocked on unsupported browsers (e.g. iOS Safari)
  }
  if (btnFullscreen) {
    btnFullscreen.textContent = document.fullscreenElement ? '⛶ Stäng helskärm' : '⛶ Helskärm';
  }
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

function resetWorld({ clearSave = true } = {}) {
  starsCollected = 0;
  deaths = 0;
  runTime = 0;
  worldTime = 0;
  dimensionMix = 0;
  cameraTrauma = 0;
  currentChapterIdx = 0;
  isFullRun = true;
  ghostSamples = [];
  ghostSampleTimer = 0;
  activeGhost = readJsonStorage(GHOST_KEY, null);
  gameWon = false;
  paused = false;
  pauseOverlay.classList.add('hidden');
  btnPause.textContent = '⏸ Meny';
  world.loadWorld(WORLD_DATA);
  player.spawn(WORLD_DATA.spawn);
  player.updateGhost(null);
  camX = player.x + 2.5;
  camY = -0.8;
  if (clearSave) clearSavedRun();
  updateHUD();
}

function startChapter(chapterIdx) {
  resetWorld({ clearSave: true });
  isFullRun = chapterIdx === 0;
  currentChapterIdx = chapterIdx;

  let spawnPos = { ...WORLD_DATA.spawn };
  if (chapterIdx > 0) {
    const startX = chapterIdx * 300;
    const cpIdx = world.checkpoints.findIndex((cp) => Math.abs(cp.x - startX) < 1);
    if (cpIdx >= 0) {
      world.checkpoints[cpIdx].activated = true;
      spawnPos = { x: world.checkpoints[cpIdx].x, y: world.checkpoints[cpIdx].y + 0.4 };
    } else {
      spawnPos = { x: startX, y: -1.0 };
    }
  }

  player.spawn(spawnPos);
  dimensionMix = computeTargetDimension();
  camX = player.x + 2.5;
  camY = Math.max(-1.6, Math.min(2.2, player.y * 0.4));
  updateHUD();
  showBanner(WORLD_DATA.sections[chapterIdx].name, 2.6);
}

function resumeSavedRun() {
  const save = readJsonStorage(SAVE_STATE_KEY, null);
  if (!save || !save.spawnPos) {
    resetWorld({ clearSave: true });
    return;
  }
  resetWorld({ clearSave: false });
  if (Array.isArray(save.activeCheckpoints)) {
    for (const idx of save.activeCheckpoints) {
      if (world.checkpoints[idx]) world.checkpoints[idx].activated = true;
    }
  }
  if (Array.isArray(save.collectedStarIndices)) {
    for (const idx of save.collectedStarIndices) {
      if (world.stars[idx]) world.stars[idx].collected = true;
    }
    starsCollected = save.collectedStarIndices.length;
  }
  runTime = Number(save.runTime) || 0;
  deaths = Number(save.deaths) || 0;
  isFullRun = false; // Mid-session reload cannot safely overwrite full-run ghost
  player.spawn(save.spawnPos);
  currentChapterIdx = getChapterIndexForX(player.x);
  dimensionMix = computeTargetDimension();
  camX = player.x + 2.5;
  camY = Math.max(-1.6, Math.min(2.2, player.y * 0.4));
  updateHUD();
}

function triggerVictory() {
  if (gameWon) return;
  gameWon = true;
  sound.playPageFlip();
  updateChapterStarsProgress();
  clearSavedRun();

  let bestTime = Number(localStorage.getItem(BEST_TIME_KEY) || Infinity);
  let bestStars = Number(localStorage.getItem(BEST_STARS_KEY) || 0);
  if (isFullRun && runTime < bestTime) {
    bestTime = runTime;
    localStorage.setItem(BEST_TIME_KEY, bestTime.toFixed(1));
    if (ghostSamples.length > 2) {
      writeJsonStorage(GHOST_KEY, ghostSamples);
    }
  }
  if (starsCollected > bestStars) {
    bestStars = starsCollected;
    localStorage.setItem(BEST_STARS_KEY, String(bestStars));
  }

  const modeNote = isFullRun ? '' : ' (Kapitelträning)';
  winStatsEl.textContent = `Du samlade ${starsCollected} av ${WORLD_DATA.stars.length} stjärnor på ${formatTime(runTime)} (${deaths} omstarter)${modeNote}!`;
  const bestTimeLabel = Number.isFinite(bestTime) ? formatTime(bestTime) : '—';
  winBestEl.textContent = `Personbästa (hel bok): ${bestTimeLabel} • Flest stjärnor: ${bestStars} / ${WORLD_DATA.stars.length}`;
  winOverlay.classList.remove('hidden');
}

syncMuteLabels();
refreshChapterUI();
refreshResumeButton();
resetWorld({ clearSave: false });

btnStart.addEventListener('click', () => {
  sound.init();
  sound.playPageFlip();
  resetWorld({ clearSave: true });
  startOverlay.classList.add('hidden');
  hud.classList.remove('hidden');
  gameStarted = true;
  showBanner(WORLD_DATA.sections[0].name, 2.4);
  if (isMobile) tryLockLandscape();
});

if (btnResumeSaved) {
  btnResumeSaved.addEventListener('click', () => {
    sound.init();
    sound.playPageFlip();
    resumeSavedRun();
    startOverlay.classList.add('hidden');
    hud.classList.remove('hidden');
    gameStarted = true;
    showBanner(`Fortsätter • ${WORLD_DATA.sections[currentChapterIdx].name}`, 2.4);
    if (isMobile) tryLockLandscape();
  });
}

chapterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const idx = Number(btn.dataset.chapter || 0);
    sound.init();
    sound.playPageFlip();
    startChapter(idx);
    startOverlay.classList.add('hidden');
    hud.classList.remove('hidden');
    gameStarted = true;
    if (isMobile) tryLockLandscape();
  });
});

btnPlayAgain.addEventListener('click', () => {
  sound.init();
  sound.playPageFlip();
  winOverlay.classList.add('hidden');
  resetWorld({ clearSave: true });
  gameStarted = true;
  showBanner(WORLD_DATA.sections[0].name, 2.4);
});

btnPause.addEventListener('click', togglePause);
btnResume.addEventListener('click', () => setPaused(false));
btnCheckpoint.addEventListener('click', respawnAtCheckpoint);
btnFullRestart.addEventListener('click', () => resetWorld({ clearSave: true }));
btnRestart.addEventListener('click', () => {
  if (gameStarted && !gameWon) {
    resetWorld({ clearSave: true });
  }
});
btnMute.addEventListener('click', toggleMute);
if (btnMutePause) btnMutePause.addEventListener('click', toggleMute);
if (btnFullscreen) btnFullscreen.addEventListener('click', toggleFullscreen);
if (btnDismissRotate && rotateHint) {
  btnDismissRotate.addEventListener('click', () => rotateHint.classList.add('hidden'));
}
if (btnClearCacheStart) btnClearCacheStart.addEventListener('click', clearAppCache);
if (btnClearCachePause) btnClearCachePause.addEventListener('click', clearAppCache);

function sampleGhostPose(t) {
  if (!Array.isArray(activeGhost) || activeGhost.length < 2) return null;
  const fIdx = t / 0.1;
  const i0 = Math.floor(fIdx);
  if (i0 < 0 || i0 >= activeGhost.length - 1) return null;
  const s0 = activeGhost[i0];
  const s1 = activeGhost[i0 + 1];
  const alpha = fIdx - i0;
  return {
    x: s0[0] + (s1[0] - s0[0]) * alpha,
    y: s0[1] + (s1[1] - s0[1]) * alpha,
    facing: s0[2] || 1,
  };
}

// Main loop
let lastTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  const padState = pollGamepad();

  if (!paused) {
    worldTime += dt;
    const targetDim = computeTargetDimension();
    const dimSpeed = player.dead ? 10 : 3.2;
    dimensionMix += (targetDim - dimensionMix) * Math.min(1, dt * dimSpeed);
    world.update(worldTime, dt, dimensionMix, camX);
  }

  if (gameStarted && !gameWon && !paused) {
    runTime += dt;
    const input = {
      left: keys.has('KeyA') || keys.has('ArrowLeft') || touchState.left || padState.left,
      right: keys.has('KeyD') || keys.has('ArrowRight') || touchState.right || padState.right,
      up: keys.has('KeyW') || keys.has('ArrowUp') || touchState.up || touchState.dashUp || padState.up,
      jumpPressed: jumpJustPressed,
      jumpHeld:
        keys.has('Space') ||
        keys.has('KeyW') ||
        keys.has('ArrowUp') ||
        touchState.jumpHeld ||
        padState.jumpHeld,
      dashPressed: dashJustPressed,
    };

    const result = player.update(dt, input, world);
    if (result.starsCollectedNow > 0) {
      starsCollected += result.starsCollectedNow;
      updateChapterStarsProgress();
      saveMidRunState();
    }
    if (result.checkpointActivated) {
      showBanner('⚑ Checkpoint sparad!', 1.8);
      saveMidRunState();
    }
    if (result.died) {
      deaths += 1;
      cameraTrauma = Math.min(1, cameraTrauma + 0.6);
      triggerHaptic(180, 0.5, 0.8);
    }
    if (result.bounced) {
      cameraTrauma = Math.min(1, cameraTrauma + 0.22);
      triggerHaptic(60, 0.35, 0.2);
    }
    if (result.dashed) {
      cameraTrauma = Math.min(1, cameraTrauma + 0.16);
      triggerHaptic(45, 0.25, 0.15);
    }
    if (result.crumbleTriggered) {
      cameraTrauma = Math.min(1, cameraTrauma + 0.14);
    }

    const nextChapterIdx = getChapterIndexForX(player.x);
    if (nextChapterIdx !== currentChapterIdx) {
      if (nextChapterIdx > currentChapterIdx) {
        sound.playPageFlip();
        showBanner(WORLD_DATA.sections[nextChapterIdx].name, 2.6);
      }
      currentChapterIdx = nextChapterIdx;
    }

    if (isFullRun && !player.dead && ghostSamples.length < 12000) {
      ghostSampleTimer += dt;
      if (ghostSampleTimer >= 0.1) {
        ghostSampleTimer -= 0.1;
        ghostSamples.push([
          Math.round(player.x * 100) / 100,
          Math.round(player.y * 100) / 100,
          player.facing,
        ]);
      }
    }

    player.updateGhost(isFullRun ? sampleGhostPose(runTime) : null, dimensionMix);
    updateHUD();
    if (result.reachedGoal) {
      triggerVictory();
    }
  } else if (!paused) {
    player.updateParticles(dt);
    player.updateGhost(null, dimensionMix);
  }

  jumpJustPressed = false;
  dashJustPressed = false;
  touchState.dashUp = false;

  cameraTrauma = Math.max(0, cameraTrauma - dt * 2.4);
  const shakeMag = cameraTrauma * cameraTrauma * 0.32;
  const shakeX = shakeMag > 0.001 ? Math.sin(worldTime * 57) * shakeMag : 0;
  const shakeY = shakeMag > 0.001 ? Math.cos(worldTime * 49) * shakeMag : 0;

  // Smooth 2.5D dolly-zoom camera: constant visible height (11.36 units at z = 0)
  // On narrow portrait screens, pull back slightly so horizontal lookahead remains playable
  const fov = 10 + 28 * dimensionMix;
  const baseCamZ = 11.36 / (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2)));
  const portraitZoom = camera.aspect < 1.2 ? Math.max(1, 1.25 / Math.max(0.55, camera.aspect)) : 1;
  const camZ = baseCamZ * portraitZoom;
  const targetFar = camZ + 50;
  if (Math.abs(camera.fov - fov) > 0.01 || Math.abs(camera.far - targetFar) > 0.1) {
    camera.fov = fov;
    camera.far = targetFar;
    camera.updateProjectionMatrix();
  }

  const lookAhead = player.facing * 2.4;
  const targetCamX = Math.max(4, Math.min(WORLD_DATA.goal.x - 4, player.x + lookAhead));
  const targetCamY = Math.max(-1.6, Math.min(2.2, player.y * 0.4));

  camX += (targetCamX - camX) * Math.min(1, dt * 5.2);
  camY += (targetCamY - camY) * Math.min(1, dt * 4.2);

  camera.position.set(camX + shakeX, camY + 0.35 * dimensionMix + shakeY, camZ);
  camera.lookAt(
    camX + player.facing * 0.35 * dimensionMix + shakeX * 0.4,
    camY + shakeY * 0.4,
    0
  );

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
