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
  assert.equal(fire(game), true); assert.equal(game.player.ammo, 4);
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

test('máximo de 15 balas en total y recargas de un cargador de 5', () => {
  const game = activeGame();
  game.enemies = [];
  assert.equal(game.player.ammo, 5);
  assert.equal(game.player.reserve, 10);
  for (let magazine = 0; magazine < 3; magazine++) {
    for (let shot = 0; shot < 5; shot++) {
      assert.equal(fire(game), true);
      tick(game, 0.3);
      assert.ok(game.player.ammo + game.player.reserve <= 15);
    }
    assert.equal(game.player.ammo, 0);
    assert.equal(fire(game), false);
    if (magazine < 2) {
      const total = game.player.reserve;
      assert.equal(startReload(game), true);
      tick(game, 1.4);
      assert.equal(game.player.ammo, 5);
      assert.equal(game.player.ammo + game.player.reserve, total);
    }
  }
  assert.equal(game.player.reserve, 0);
  assert.equal(startReload(game), false);
});

test('pausa congela tiempo, movimiento, daño y recarga', () => {
  const game = activeGame(); game.player.ammo = 0; startReload(game); game.status = 'paused';
  const before = structuredClone(game);
  tick(game, 3, { forward: true });
  assert.deepEqual(game, before);
});

test('botiquines automáticos: curan 25, máximo 100 y no se consumen con vida completa', () => {
  const game = activeGame();
  const health = game.pickups.find((item) => item.type === 'health');
  Object.assign(game.player, { x: health.x, z: health.z });
  tick(game, 0.05); assert.equal(health.active, true);
  game.player.health = 50; tick(game, 0.05);
  assert.equal(game.player.health, 75); assert.equal(health.active, false);
  tick(game, 0.05); assert.equal(game.player.health, 75);
  const next = game.pickups.find((item) => item.type === 'health' && item.active);
  Object.assign(game.player, { x: next.x, z: next.z, health: 90 });
  tick(game, 0.05); assert.equal(game.player.health, 100);
  assert.equal(next.active, false);
});

test('munición automática: rellena cargador y reserva, también durante una recarga', () => {
  const game = activeGame();
  const ammo = game.pickups.find((item) => item.type === 'ammo');
  Object.assign(game.player, { x: ammo.x, z: ammo.z, ammo: 1, reserve: 3 });
  startReload(game);
  tick(game, 0.05);
  assert.equal(game.player.ammo, SETTINGS.magazine);
  assert.equal(game.player.reserve, SETTINGS.maxReserve);
  assert.equal(game.reload, 0); assert.equal(ammo.active, false);
  tick(game, 1.4);
  assert.equal(game.player.reserve, SETTINGS.maxReserve);
  const next = game.pickups.find((item) => item.type === 'ammo' && item.active);
  Object.assign(game.player, { x: next.x, z: next.z });
  tick(game, 0.05); assert.equal(next.active, true);
  game.player.ammo = 0;
  tick(game, 0.05);
  assert.equal(game.player.ammo, SETTINGS.magazine); assert.equal(next.active, false);
});

test('escudos automáticos: suman 10 hasta 50 y se conservan al llegar al máximo', () => {
  const game = activeGame();
  const shields = game.pickups.filter((item) => item.type === 'shield');
  assert.ok(shields.length >= 6);
  assert.equal(game.player.shield, 0);
  for (let i = 0; i < 5; i++) {
    Object.assign(game.player, { x: shields[i].x, z: shields[i].z });
    tick(game, 0.05);
    assert.equal(game.player.shield, (i + 1) * 10);
    assert.equal(shields[i].active, false);
  }
  Object.assign(game.player, { x: shields[5].x, z: shields[5].z });
  tick(game, 0.05);
  assert.equal(game.player.shield, 50); assert.equal(shields[5].active, true);
  game.player.shield = 47;
  tick(game, 0.05);
  assert.equal(game.player.shield, 50); assert.equal(shields[5].active, false);
});

test('el escudo absorbe primero el daño y el sobrante reduce la vida', () => {
  const game = activeGame();
  game.player.shield = 20;
  damagePlayer(game, 12);
  assert.equal(game.player.shield, 8); assert.equal(game.player.health, 100);
  damagePlayer(game, 12);
  assert.equal(game.player.shield, 0); assert.equal(game.player.health, 96);
  damagePlayer(game, 12);
  assert.equal(game.player.health, 84);
});

test('los suministros solo se recogen al acercarse durante la partida', () => {
  const game = activeGame();
  game.player.health = 50;
  tick(game, 0.05);
  assert.equal(game.player.health, 50); assert.equal(game.player.shield, 0);
  assert.ok(game.pickups.every((item) => item.active));
  const health = game.pickups.find((item) => item.type === 'health');
  Object.assign(game.player, { x: health.x, z: health.z });
  game.status = 'paused'; tick(game, 0.05);
  assert.equal(health.active, true); assert.equal(game.player.health, 50);
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
  assert.equal(fresh.player.health, 100); assert.equal(fresh.player.ammo, 5);
  assert.equal(fresh.player.reserve, 10);
  assert.equal(fresh.player.shield, 0);
  assert.ok(fresh.enemies.every((enemy) => enemy.hp === 2));
  assert.ok(fresh.pickups.every((item) => item.active)); assert.equal(fresh.status, 'ready');
});
