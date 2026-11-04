import { test, expect } from '@playwright/test';

async function state(page) {
  return page.evaluate(async () => structuredClone((await import('/src/main.js')).game));
}
async function start(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Jugar' }).click();
  await expect.poll(async () => (await state(page)).status).toBe('playing');
}
async function shoot(page) {
  // Con Pointer Lock, mover a unas coordenadas gira la cámara. Disparamos sin mover.
  await page.mouse.down();
  await page.mouse.up();
}

test('carga WebGL sin errores y muestra el menú y la arena', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Jugar' })).toBeEnabled();
  await expect(page.locator('#screen-title')).toContainText('Voltor');
  await page.screenshot({ path: testInfo.outputPath('menu.png') });
  await page.getByRole('button', { name: 'Jugar' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  expect(await page.evaluate(async () => (await import('/src/main.js')).view.renderer.capabilities.isWebGL2)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('arena.png') });
  expect(errors).toEqual([]);
});

test('WASD, ratón, colisiones, pausa y reanudación con entradas reales', async ({ page }) => {
  await start(page);
  const before = await state(page);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(400); await page.keyboard.up('KeyW');
  expect((await state(page)).player.z).toBeLessThan(before.player.z - 0.5);
  await page.mouse.move(820, 450);
  await expect.poll(async () => Math.abs((await state(page)).player.yaw)).toBeGreaterThan(0.01);
  // Coloca al operador frente al muro exterior; el movimiento sigue siendo WASD real.
  await page.evaluate(async () => {
    const { game } = await import('/src/main.js');
    Object.assign(game.player, { x: 4.5, z: 4.5, yaw: 0, pitch: 0 });
  });
  await page.keyboard.down('KeyW'); await page.waitForTimeout(650); await page.keyboard.up('KeyW');
  expect((await state(page)).player.z).toBeGreaterThanOrEqual(3.3);
  // Escape sintético no siempre libera Pointer Lock en Chromium headless.
  // exitPointerLock activa el mismo evento nativo usado por Escape en escritorio.
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.getByRole('button', { name: 'Continuar' })).toBeVisible();
  const paused = await state(page);
  await page.keyboard.press('KeyW'); await page.waitForTimeout(200);
  expect(await state(page)).toEqual(paused);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
});

test('clic dispara, mata con dos impactos y R recarga conservando munición', async ({ page }) => {
  await start(page);
  await shoot(page);
  await expect(page.locator('#ammo')).toHaveText('04');
  await expect.poll(async () => (await state(page)).enemies[4].hp).toBe(1);
  await page.waitForTimeout(300);
  await shoot(page);
  await expect(page.locator('#kill-count')).toHaveText('01 / 06');
  await expect(page.locator('#ammo')).toHaveText('03');
  await page.keyboard.press('KeyR');
  await expect(page.locator('#combat-status')).toHaveText('Recargando...');
  await shoot(page);
  await expect(page.locator('#ammo')).toHaveText('05', { timeout: 5000 });
  await expect(page.locator('#reserve')).toHaveText('08');
});

test('los disparos no atraviesan las paredes', async ({ page }) => {
  await start(page);
  await page.evaluate(async () => {
    const { game } = await import('/src/main.js');
    Object.assign(game.player, { x: 22.5, z: 43.5, yaw: -Math.PI / 2, pitch: 0 });
    Object.assign(game.enemies[0], { x: 28.5, z: 43.5, cooldown: 20 });
  });
  await shoot(page);
  await expect(page.locator('#ammo')).toHaveText('04');
  expect((await state(page)).enemies[0].hp).toBe(2);
  expect((await state(page)).kills).toBe(0);
});

test('victoria mediante disparo final y reinicio limpio desde el botón', async ({ page }) => {
  await start(page);
  await page.evaluate(async () => {
    const { game } = await import('/src/main.js');
    game.enemies.forEach((enemy, index) => { enemy.hp = index === 4 ? 1 : 0; });
    game.kills = 5;
  });
  await shoot(page);
  await expect(page.locator('#screen-title')).toContainText('Has ganado');
  expect((await state(page)).status).toBe('won');
  expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await page.getByRole('button', { name: 'Volver a jugar' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  const fresh = await state(page);
  expect(fresh.player.health).toBe(100); expect(fresh.player.ammo).toBe(5);
  expect(fresh.player.reserve).toBe(10);
  expect(fresh.kills).toBe(0); expect(fresh.enemies.every((enemy) => enemy.hp === 2)).toBe(true);
});

test('ataque enemigo causa derrota y Enter reinicia la misión', async ({ page }) => {
  await start(page);
  await page.evaluate(async () => {
    const { game } = await import('/src/main.js');
    game.player.health = 12;
    Object.assign(game.enemies[4], { x: game.player.x, z: game.player.z - 1, cooldown: 0 });
  });
  await expect(page.locator('#screen-title')).toContainText('Has perdido');
  await expect(page.locator('#health')).toHaveText('0');
  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#health')).toHaveText('100');
});

test('reiniciar desde pausa y recoger suministros actualiza el HUD', async ({ page }) => {
  await start(page);
  await page.evaluate(async () => {
    const { game } = await import('/src/main.js');
    const item = game.pickups.find((entry) => entry.type === 'health');
    Object.assign(game.player, { x: item.x, z: item.z, health: 50 });
  });
  await expect(page.locator('#health')).toHaveText('75');
  await page.evaluate(() => document.exitPointerLock());
  await page.getByRole('button', { name: 'Reiniciar' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  const fresh = await state(page);
  expect(fresh.player.health).toBe(100); expect(fresh.player.shield).toBe(0);
  expect(fresh.pickups.every((item) => item.active)).toBe(true);
});

test('caminar sobre los tres suministros los recoge automáticamente y el escudo protege la vida', async ({ page }, testInfo) => {
  await start(page);
  // Aislar la recogida de los ataques: el movimiento y el bucle siguen siendo reales.
  await page.evaluate(async () => {
    const { game } = await import('/src/main.js');
    game.enemies.forEach((enemy) => { enemy.hp = 0; });
  });
  for (const type of ['health', 'ammo', 'shield']) {
    await page.evaluate(async (type) => {
      const { game } = await import('/src/main.js');
      const item = game.pickups.find((entry) => entry.type === type && entry.active);
      Object.assign(game.player, { x: item.x, z: item.z + 1.4, yaw: 0, pitch: 0 });
      if (type === 'health') game.player.health = 50;
      if (type === 'ammo') { game.player.ammo = 0; game.player.reserve = 0; }
    }, type);
    if (type === 'ammo') {
      // Esperar al HUD vacío antes de comprobar que el objeto lo rellena.
      await expect(page.locator('#ammo')).toHaveText('00');
      await expect(page.locator('#reserve')).toHaveText('00');
    }
    await page.keyboard.down('KeyW');
    try {
      if (type === 'health') await expect(page.locator('#health')).toHaveText('75');
      if (type === 'ammo') {
        await expect(page.locator('#ammo')).toHaveText('05');
        await expect(page.locator('#reserve')).toHaveText('10');
      }
      if (type === 'shield') await expect(page.locator('#shield')).toHaveText('10');
    } finally {
      await page.keyboard.up('KeyW');
    }
    expect((await state(page)).pickups.some((item) => item.type === type && !item.active)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath('suministros-y-escudo.png') });
  // Un ataque real gasta los 10 puntos de escudo y quita solo 2 de vida.
  await page.evaluate(async () => {
    const { game } = await import('/src/main.js');
    Object.assign(game.enemies[0], { hp: 2, x: game.player.x, z: game.player.z - 1, cooldown: 0 });
  });
  await expect(page.locator('#shield')).toHaveText('00');
  await expect(page.locator('#health')).toHaveText('73');
});

test('el menú sigue siendo utilizable en una ventana de portátil', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const button = page.getByRole('button', { name: 'Jugar' });
  await expect(button).toBeInViewport();
  await expect(page.locator('.controls')).toContainText('WASD');
  await page.screenshot({ path: testInfo.outputPath('portatil.png') });
});

test('el disparo muestra una estela y un impacto, se pausa y desaparece al continuar', async ({ page }, testInfo) => {
  await start(page);
  const result = await page.evaluate(async () => {
    const { game, view } = await import('/src/main.js');
    // Disparar y pausar en el mismo turno permite inspeccionar un efecto breve.
    document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
    game.status = 'paused';
    document.exitPointerLock();
    return {
      effects: view.shotEffects.children.length,
      parts: view.shotEffects.children[0]?.children.length,
      targetHealth: game.enemies[4].hp,
    };
  });
  expect(result).toEqual({ effects: 1, parts: 2, targetHealth: 1 });
  await expect(page.locator('#screen-title')).toHaveText('Pausa');
  await page.locator('#overlay').evaluate((element) => { element.style.visibility = 'hidden'; });
  await page.screenshot({ path: testInfo.outputPath('disparo-visible-sin-arma.png') });
  await page.locator('#overlay').evaluate((element) => { element.style.visibility = ''; });
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await expect.poll(async () => page.evaluate(async () => (await import('/src/main.js')).view.shotEffects.children.length)).toBe(0);
  await expect(page.locator('#ammo')).toHaveText('04');
});
