import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP, TILE, SETTINGS, center, createGame, canOccupy, moveBody, findPath, lineOfSight, fire, hitEnemy, damagePlayer, startReload, updateGame } from '../src/core.js';

const activeGame = () => { const game = createGame(); game.status = 'playing'; return game; };
const tick = (game, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds / 0.05); i++) updateGame(game, input, 0.05); };

test('mapa rectangular, cerrado y con rutas desde todos los enemigos y suministros', () => {
  const game = createGame();
  assert.equal(game.enemies.length, 6);
  assert.ok(MAP.every((row) => row.length === MAP[0].length && row[0] === '#' && row.at(-1) === '#'));
  assert.ok([...MAP[0], ...MAP.at(-1)].every((cell) => cell === '#'));
  for (const object of [...game.enemies, ...game.pickups]) {
    assert.ok(canOccupy(object.x, object.z));
    assert.ok(findPath(object, game.player).length > 0);
  }
});

test('colisión circular: bloquea un desplazamiento grande y permite deslizarse por la pared', () => {
  const body = center(1, 2);
  moveBody(body, -30, 0);
  assert.ok(body.x >= TILE + SETTINGS.radius);
  assert.ok(canOccupy(body.x, body.z));
  const beforeZ = body.z;
  moveBody(body, -1, 2);
  assert.ok(body.z > beforeZ + 1.9);
  assert.equal(canOccupy(-10, -10), false);
});

test('WASD normaliza la diagonal y respeta la orientación de la cámara', () => {
  const straight = activeGame(); const diagonal = activeGame(); const rotated = activeGame();
  const spawn = { ...straight.player };
  updateGame(straight, { forward: true }, 0.05);
  updateGame(diagonal, { forward: true, right: true }, 0.05);
  const distance = (game) => Math.hypot(game.player.x - spawn.x, game.player.z - spawn.z);
  assert.ok(Math.abs(distance(straight) - distance(diagonal)) < 1e-8);
  rotated.player.yaw = Math.PI / 2;
  updateGame(rotated, { forward: true }, 0.05);
  assert.ok(rotated.player.x < spawn.x);
});

test('disparo: cadencia, consumo de munición y bloqueo durante pausa/recarga', () => {
  const game = activeGame();
  assert.equal(fire(game), true); assert.equal(game.player.ammo, 7);
  assert.equal(fire(game), false);
  tick(game, 0.3); assert.equal(startReload(game), true);
  assert.equal(fire(game), false);
  game.status = 'paused'; assert.equal(fire(game), false);
});

test('recarga transfiere únicamente las células disponibles y conserva el total', () => {
  const game = activeGame(); game.player.ammo = 1; game.player.reserve = 3;
  assert.equal(startReload(game), true);
  tick(game, 1.4);
  assert.equal(game.player.ammo, 4); assert.equal(game.player.reserve, 0);
  assert.equal(startReload(game), false);
});

test('pausa congela tiempo, movimiento, daño y recarga', () => {
  const game = activeGame(); game.player.ammo = 0; startReload(game); game.status = 'paused';
  const before = structuredClone(game);
  tick(game, 3, { forward: true });
  assert.deepEqual(game, before);
});

test('suministros: un uso, límites de vida y reserva, botiquín intacto con vida completa', () => {
  const game = activeGame();
  const health = game.pickups.find((item) => item.type === 'health');
  Object.assign(game.player, { x: health.x, z: health.z });
  tick(game, 0.05); assert.equal(health.active, true);
  game.player.health = 90; tick(game, 0.05);
  assert.equal(game.player.health, 100); assert.equal(health.active, false);
  const ammo = game.pickups.find((item) => item.type === 'ammo');
  Object.assign(game.player, { x: ammo.x, z: ammo.z, reserve: 90 });
  tick(game, 0.05); assert.equal(game.player.reserve, 96); assert.equal(ammo.active, false);
});

test('dos impactos por enemigo y victoria solo tras eliminar a todos', () => {
  const game = activeGame();
  for (const enemy of game.enemies) {
    hitEnemy(game, enemy.id); assert.equal(enemy.hp, 1);
    assert.equal(game.status, 'playing');
    hitEnemy(game, enemy.id); assert.equal(enemy.hp, 0);
    assert.equal(hitEnemy(game, enemy.id), false);
  }
  assert.equal(game.kills, 6); assert.equal(game.status, 'won');
  damagePlayer(game, 100); assert.equal(game.player.health, 100);
});

test('enemigos respetan muros y llegan al jugador desde todas las zonas', () => {
  for (let id = 0; id < 6; id++) {
    const game = activeGame();
    game.enemies = [game.enemies[id]];
    const enemy = game.enemies[0];
    for (let i = 0; i < 1000 && game.player.health === 100; i++) {
      updateGame(game, {}, 0.05);
      assert.ok(canOccupy(enemy.x, enemy.z, 0.32));
    }
    assert.ok(game.player.health < 100, `El enemigo ${id} debe alcanzar y atacar al jugador`);
  }
});

test('un muro bloquea la línea de visión y los ataques cuerpo a cuerpo', () => {
  const from = center(7, 14); const to = center(9, 14);
  assert.equal(lineOfSight(from, to), false);
  const game = activeGame(); Object.assign(game.player, from);
  game.enemies = [{ ...game.enemies[0], ...to }];
  tick(game, 1); assert.equal(game.player.health, 100);
});

test('derrota por vida cero o munición agotada sin suministros restantes', () => {
  const game = activeGame(); damagePlayer(game, 1000);
  assert.equal(game.player.health, 0); assert.equal(game.status, 'lost');
  const empty = activeGame(); empty.player.ammo = empty.player.reserve = 0;
  tick(empty, 0.05); assert.equal(empty.status, 'playing');
  empty.pickups.forEach((item) => { item.active = false; });
  tick(empty, 0.05); assert.equal(empty.status, 'lost');
});

test('una nueva partida restaura los recursos y no comparte objetos con la anterior', () => {
  const old = activeGame(); damagePlayer(old, 99); old.enemies[0].hp = 0; old.pickups[0].active = false;
  const fresh = createGame();
  assert.equal(fresh.player.health, 100); assert.equal(fresh.player.ammo, 8);
  assert.ok(fresh.enemies.every((enemy) => enemy.hp === 2));
  assert.ok(fresh.pickups.every((item) => item.active)); assert.equal(fresh.status, 'ready');
});
