import { createGame, updateGame, fire, hitEnemy, startReload } from './core.js';
import { createScene } from './scene.js';

const canvas = document.querySelector('#viewport');
const overlay = document.querySelector('#overlay');
const playButton = document.querySelector('#play-button');
const restartButton = document.querySelector('#restart-button');
const title = document.querySelector('#screen-title');
const description = document.querySelector('#screen-description');
const hint = document.querySelector('#input-hint');
const keys = new Set();
export let game = createGame();
export const view = createScene(canvas, game);
let lastTime = performance.now();
let lastStatus = '';
let requestingLock = false;
let contextLost = false;

function reset() {
  game = createGame();
  keys.clear();
}

async function begin() {
  if (requestingLock) return;
  if (!canvas.requestPointerLock) {
    hint.textContent = 'Necesitas un navegador de ordenador que permita capturar el ratón.';
    return;
  }
  requestingLock = true;
  if (game.status === 'won' || game.status === 'lost') reset();
  try {
    await canvas.requestPointerLock();
  } catch {
    hint.textContent = 'No se pudo capturar el ratón. Pulsa el botón para reintentarlo.';
  } finally {
    requestingLock = false;
  }
}

function pause() {
  keys.clear();
  if (game.status === 'playing') game.status = 'paused';
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

playButton.addEventListener('click', begin);
restartButton.addEventListener('click', () => { reset(); begin(); });
document.addEventListener('pointerlockchange', () => {
  keys.clear();
  if (document.pointerLockElement === canvas) {
    if (game.status !== 'won' && game.status !== 'lost') game.status = 'playing';
    lastTime = performance.now();
  } else if (game.status === 'playing') game.status = 'paused';
});
document.addEventListener('pointerlockerror', () => {
  requestingLock = false;
  hint.textContent = 'Permite capturar el ratón y vuelve a pulsar el botón.';
});
document.addEventListener('mousemove', (event) => {
  if (document.pointerLockElement !== canvas || game.status !== 'playing') return;
  game.player.yaw -= event.movementX * 0.0022;
  game.player.pitch = Math.max(-1.25, Math.min(1.25, game.player.pitch - event.movementY * 0.0022));
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && (game.status === 'won' || game.status === 'lost') && !event.repeat) {
    event.preventDefault(); begin(); return;
  }
  if (game.status !== 'playing') return;
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyR', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  keys.add(event.code);
  if (event.code === 'KeyR' && !event.repeat) startReload(game);
});
document.addEventListener('keyup', (event) => keys.delete(event.code));
document.addEventListener('mousedown', (event) => {
  if (event.button !== 0 || document.pointerLockElement !== canvas || !fire(game)) return;
  const enemyId = view.shoot(game);
  if (enemyId !== null) hitEnemy(game, enemyId);
});
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('resize', view.resize);
canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault(); pause(); contextLost = true; updateMenu();
  title.textContent = 'Error gráfico';
  description.textContent = 'Recarga la página para volver a iniciar el juego.';
  playButton.hidden = true; restartButton.hidden = true;
});

function updateMenu() {
  if (game.status === lastStatus) return;
  lastStatus = game.status;
  const playing = game.status === 'playing';
  document.body.classList.toggle('playing', playing);
  overlay.hidden = playing;
  if (playing) return;
  keys.clear();
  restartButton.hidden = game.status !== 'paused';
  if (game.status === 'paused') {
    title.textContent = 'Pausa';
    description.textContent = 'Pulsa Continuar para seguir jugando.';
    playButton.textContent = 'Continuar';
  } else if (game.status === 'won' || game.status === 'lost') {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    title.textContent = game.status === 'won' ? 'Has ganado' : 'Has perdido';
    description.textContent = game.result;
    playButton.textContent = 'Volver a jugar';
    hint.textContent = 'Pulsa el botón o Enter para reiniciar.';
  } else {
    playButton.textContent = 'Jugar';
  }
  playButton.focus({ preventScroll: true });
}

function updateHUD() {
  document.querySelector('#health').textContent = game.player.health;
  document.querySelector('#ammo').textContent = String(game.player.ammo).padStart(2, '0');
  document.querySelector('#reserve').textContent = String(game.player.reserve).padStart(2, '0');
  document.querySelector('#kill-count').textContent = `${String(game.kills).padStart(2, '0')} / ${String(game.enemies.length).padStart(2, '0')}`;
  const minutes = Math.floor(game.elapsed / 60);
  const seconds = Math.floor(game.elapsed % 60);
  document.querySelector('#time').textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  document.querySelector('#combat-status').textContent = game.reload > 0 ? 'Recargando...' : game.player.ammo === 0 ? 'Sin munición. Pulsa R.' : '';
  document.querySelector('#toast').textContent = game.noticeTime > 0 && game.status === 'playing' ? game.notice : '';
}

function frame(now) {
  if (contextLost) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  const input = {
    forward: keys.has('KeyW') || keys.has('ArrowUp'),
    backward: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
  updateGame(game, input, dt);
  view.render(game);
  updateHUD();
  updateMenu();
  requestAnimationFrame(frame);
}

playButton.disabled = false;
playButton.textContent = 'Jugar';
requestAnimationFrame(frame);
