// Reglas y colisiones independientes de WebGL, comprobables con node:test.
export const TILE = 3;
export const MAP = [
  '#################',
  '#...E...#...A...#',
  '#.......#.......#',
  '#..##.......##..#',
  '#..##...E...##..#',
  '#.......#.......#',
  '#A..E...#...E.H.#',
  '#.......#.......#',
  '###..#######..###',
  '#...............#',
  '#..##.......##..#',
  '#..##...E...##..#',
  '#...............#',
  '#H......P......A#',
  '#.......#.......#',
  '#...A...#...E...#',
  '#################',
];
export const SETTINGS = Object.freeze({ radius: 0.3, eyeHeight: 1.6, speed: 4.8, sprint: 6.8, magazine: 8, reserve: 40, reloadSeconds: 1.25, fireDelay: 0.24, enemySpeed: 1.5, enemyDamage: 12, attackDelay: 0.95 });
export const center = (col, row) => ({ x: (col + 0.5) * TILE, z: (row + 0.5) * TILE });
export const cellAt = (x, z) => ({ col: Math.floor(x / TILE), row: Math.floor(z / TILE) });
export const wallAt = (col, row) => !MAP[row]?.[col] || MAP[row][col] === '#';

export function canOccupy(x, z, radius = SETTINGS.radius) {
  for (let row = Math.floor((z - radius) / TILE); row <= Math.floor((z + radius) / TILE); row++) {
    for (let col = Math.floor((x - radius) / TILE); col <= Math.floor((x + radius) / TILE); col++) {
      if (!wallAt(col, row)) continue;
      const nearX = Math.max(col * TILE, Math.min(x, (col + 1) * TILE));
      const nearZ = Math.max(row * TILE, Math.min(z, (row + 1) * TILE));
      if ((x - nearX) ** 2 + (z - nearZ) ** 2 < radius ** 2) return false;
    }
  }
  return true;
}

// Subpasos impiden atravesar paredes incluso tras una caída de FPS.
export function moveBody(body, dx, dz, radius = SETTINGS.radius) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius * 0.5)));
  for (let step = 0; step < steps; step++) {
    if (canOccupy(body.x + dx / steps, body.z, radius)) body.x += dx / steps;
    if (canOccupy(body.x, body.z + dz / steps, radius)) body.z += dz / steps;
  }
}

export function lineOfSight(from, to) {
  const distance = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(distance / 0.15));
  for (let i = 0; i <= steps; i++) {
    const { col, row } = cellAt(from.x + (to.x - from.x) * i / steps, from.z + (to.z - from.z) * i / steps);
    if (wallAt(col, row)) return false;
  }
  return true;
}

// Búsqueda en anchura: todos los enemigos pueden rodear los muros del sector.
export function findPath(from, to) {
  const start = cellAt(from.x, from.z);
  const goal = cellAt(to.x, to.z);
  const key = ({ col, row }) => `${col},${row}`;
  const queue = [start];
  const parents = new Map([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (key(current) === key(goal)) {
      const path = [];
      for (let node = current; parents.get(key(node)); node = parents.get(key(node))) path.unshift(center(node.col, node.row));
      return path;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { col: current.col + dx, row: current.row + dz };
      if (!wallAt(next.col, next.row) && !parents.has(key(next))) {
        parents.set(key(next), current);
        queue.push(next);
      }
    }
  }
  return [];
}

export function createGame() {
  const enemies = [];
  const pickups = [];
  let spawn;
  MAP.forEach((line, row) => [...line].forEach((symbol, col) => {
    const position = center(col, row);
    if (symbol === 'P') spawn = position;
    if (symbol === 'E') enemies.push({ id: enemies.length, ...position, hp: 2, cooldown: 0.8, path: [], pathTimer: 0 });
    if (symbol === 'A' || symbol === 'H') pickups.push({ id: pickups.length, ...position, type: symbol === 'A' ? 'ammo' : 'health', active: true });
  }));
  return { status: 'ready', player: { ...spawn, yaw: 0, pitch: 0, health: 100, ammo: SETTINGS.magazine, reserve: SETTINGS.reserve }, enemies, pickups, kills: 0, elapsed: 0, reload: 0, fireCooldown: 0, notice: '', noticeTime: 0, result: '' };
}

export function announce(game, message, duration = 2) {
  game.notice = message;
  game.noticeTime = duration;
}

export function startReload(game) {
  if (game.status !== 'playing' || game.reload > 0 || game.player.ammo === SETTINGS.magazine || game.player.reserve === 0) return false;
  game.reload = SETTINGS.reloadSeconds;
  announce(game, 'Recargando...', SETTINGS.reloadSeconds);
  return true;
}

export function fire(game) {
  if (game.status !== 'playing' || game.reload > 0 || game.fireCooldown > 0) return false;
  if (game.player.ammo <= 0) {
    announce(game, game.player.reserve ? 'Pulsa R para recargar' : 'Busca una caja de munición');
    return false;
  }
  game.player.ammo--;
  game.fireCooldown = SETTINGS.fireDelay;
  return true;
}

export function hitEnemy(game, id) {
  const enemy = game.enemies.find((entry) => entry.id === id);
  if (game.status !== 'playing' || !enemy || enemy.hp <= 0) return false;
  enemy.hp--;
  if (!enemy.hp) {
    game.kills++;
    announce(game, `Enemigo eliminado: ${game.kills} de ${game.enemies.length}`);
    if (game.kills === game.enemies.length) {
      game.status = 'won';
      game.result = 'Has eliminado a todos los enemigos.';
    }
  }
  return true;
}

export function damagePlayer(game, amount) {
  if (game.status !== 'playing') return;
  game.player.health = Math.max(0, game.player.health - amount);
  if (!game.player.health) {
    game.status = 'lost';
    game.result = 'Te has quedado sin vida. Puedes volver a intentarlo.';
  }
}

function collect(game) {
  for (const item of game.pickups) {
    if (!item.active || Math.hypot(item.x - game.player.x, item.z - game.player.z) > 1) continue;
    if (item.type === 'health') {
      if (game.player.health >= 100) continue;
      game.player.health = Math.min(100, game.player.health + 35);
      announce(game, 'Botiquín: +35 de vida');
    } else {
      if (game.player.reserve >= 96) continue;
      game.player.reserve = Math.min(96, game.player.reserve + 16);
      announce(game, 'Munición: +16 balas');
    }
    item.active = false;
  }
}

export function updateGame(game, input, dt) {
  if (game.status !== 'playing') return;
  dt = Math.max(0, Math.min(dt, 0.05));
  game.elapsed += dt;
  game.fireCooldown = Math.max(0, game.fireCooldown - dt);
  game.noticeTime = Math.max(0, game.noticeTime - dt);
  if (game.reload > 0) {
    game.reload = Math.max(0, game.reload - dt);
    if (game.reload === 0) {
      const amount = Math.min(SETTINGS.magazine - game.player.ammo, game.player.reserve);
      game.player.ammo += amount;
      game.player.reserve -= amount;
      announce(game, 'Arma recargada', 0.6);
    }
  }
  const forward = Number(input.forward || false) - Number(input.backward || false);
  const sideways = Number(input.right || false) - Number(input.left || false);
  const length = Math.hypot(forward, sideways) || 1;
  const speed = (input.sprint ? SETTINGS.sprint : SETTINGS.speed) * dt / length;
  const { yaw } = game.player;
  moveBody(game.player, (-Math.sin(yaw) * forward + Math.cos(yaw) * sideways) * speed, (-Math.cos(yaw) * forward - Math.sin(yaw) * sideways) * speed);
  collect(game);
  for (const enemy of game.enemies) {
    if (enemy.hp <= 0) continue;
    enemy.cooldown = Math.max(0, enemy.cooldown - dt);
    enemy.pathTimer -= dt;
    const distance = Math.hypot(game.player.x - enemy.x, game.player.z - enemy.z);
    if (distance > 1.05) {
      if (enemy.pathTimer <= 0) {
        enemy.path = findPath(enemy, game.player);
        enemy.pathTimer = 0.6;
      }
      // Seguir centros de casilla evita cortar esquinas en las colisiones.
      let target = enemy.path[0];
      if (target && Math.hypot(target.x - enemy.x, target.z - enemy.z) < 0.12) {
        enemy.path.shift();
        target = enemy.path[0];
      }
      const sameCell = cellAt(enemy.x, enemy.z).col === cellAt(game.player.x, game.player.z).col && cellAt(enemy.x, enemy.z).row === cellAt(game.player.x, game.player.z).row;
      if (sameCell || (distance < 4 && lineOfSight(enemy, game.player))) target = game.player;
      if (target) {
        const dx = target.x - enemy.x;
        const dz = target.z - enemy.z;
        const norm = Math.hypot(dx, dz) || 1;
        const step = Math.min(norm, SETTINGS.enemySpeed * dt);
        moveBody(enemy, dx / norm * step, dz / norm * step, 0.32);
      }
    }
    if (distance < 1.3 && enemy.cooldown <= 0 && lineOfSight(enemy, game.player)) {
      damagePlayer(game, SETTINGS.enemyDamage);
      enemy.cooldown = SETTINGS.attackDelay;
      if (game.status !== 'playing') break;
    }
  }
  if (game.status === 'playing' && !game.player.ammo && !game.player.reserve && !game.pickups.some((item) => item.active && item.type === 'ammo')) {
    game.status = 'lost';
    game.result = 'No queda munición. Cada enemigo necesita dos impactos.';
  }
}
