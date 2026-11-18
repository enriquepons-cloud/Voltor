import { test, expect } from '@playwright/test';

async function inspectModels(page, modulePath = '/src/main.js') {
  return page.evaluate(async (modulePath) => {
    const { game, view } = await import(modulePath);
    const loaded = await view.modelsReady;
    // Esperar al siguiente dibujo para comprobar también las visibilidades.
    await new Promise(requestAnimationFrame);
    return {
      loaded,
      expected: game.enemies.length + game.pickups.length,
      enemies: game.enemies.map((enemy) => {
        const group = view.scene.getObjectByName(`enemigo:${enemy.id}`);
        return group.visible && group.children[0]?.name === 'modelo:malvat.glb';
      }),
      pickups: game.pickups.map((item) => {
        const group = view.scene.getObjectByName(`suministro:${item.id}`);
        return group.children.some((child) => child.visible && child.name.startsWith('modelo:'));
      }),
    };
  }, modulePath);
}

test('carga los GLB reales, recoge sus modelos y los recupera al reiniciar', async ({ page }) => {
  await page.goto('/');
  const models = await inspectModels(page);
  expect(models.loaded).toHaveLength(models.expected);
  expect(models.loaded.every(Boolean)).toBe(true);
  expect(models.enemies.every(Boolean)).toBe(true);
  expect(models.pickups.every(Boolean)).toBe(true);
  await page.getByRole('button', { name: 'Jugar' }).click();
  await page.evaluate(async () => {
    const { game } = await import('/src/main.js');
    const item = game.pickups.find((entry) => entry.type === 'health');
    Object.assign(game.player, { x: item.x, z: item.z, health: 50 });
  });
  await expect(page.locator('#health')).toHaveText('75');
  expect(await page.evaluate(async () => {
    const { game, view } = await import('/src/main.js');
    const item = game.pickups.find((entry) => entry.type === 'health');
    return view.scene.getObjectByName(`suministro:${item.id}`).visible;
  })).toBe(false);
  await page.evaluate(() => document.exitPointerLock());
  await page.getByRole('button', { name: 'Reiniciar', exact: true }).click();
  await expect(page.locator('#health')).toHaveText('100');
  expect(await page.evaluate(async () => {
    const { game, view } = await import('/src/main.js');
    return game.pickups.every((item) => view.scene.getObjectByName(`suministro:${item.id}`).visible);
  })).toBe(true);
});

test('los disparos alcanzan los laterales y pies visibles del enemigo GLB', async ({ page }) => {
  await page.goto('/');
  await inspectModels(page);
  const hits = await page.evaluate(async () => {
    const { game, view } = await import('/src/main.js');
    game.enemies.forEach((enemy, index) => { enemy.hp = index === 4 ? 2 : 0; });
    Object.assign(game.enemies[4], { x: 25.5, z: 34.5 });
    return [{ x: 26.02, y: 1.5 }, { x: 25.5, y: 0.05 }].map(({ x, y }) => {
      Object.assign(game.player, { x, z: 37.5, yaw: 0, pitch: Math.atan2(y - 1.6, 3) });
      return view.shoot(game);
    });
  });
  expect(hits).toEqual([4, 4]);
});

test('carga los modelos al entrar desde la página principal con Python', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5175/Pagina_web/');
  await page.getByRole('link', { name: 'Abrir el juego' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:5175/Pagina_web/juego-threejs/');
  const models = await inspectModels(page, '/Pagina_web/juego-threejs/src/main.js');
  expect(models.loaded.every(Boolean)).toBe(true);
  expect(models.enemies.every(Boolean)).toBe(true);
  expect(models.pickups.every(Boolean)).toBe(true);
  await page.getByRole('button', { name: 'Jugar' }).click();
  await expect(page.locator('#overlay')).toBeHidden();
  expect(errors).toEqual([]);
});

test('si falla un GLB conserva la figura provisional y se puede jugar', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/malvat.glb', (route) => route.fulfill({ status: 404, body: 'Modelo no encontrado' }));
  await page.goto('/');
  const models = await inspectModels(page);
  expect(models.loaded.filter((loaded) => !loaded)).toHaveLength(6);
  expect(models.enemies.every((loaded) => !loaded)).toBe(true);
  expect(models.pickups.every(Boolean)).toBe(true);
  expect(await page.evaluate(async () => {
    const { view } = await import('/src/main.js');
    return view.scene.children.filter((child) => child.isSprite && child.visible).length;
  })).toBe(6);
  await page.getByRole('button', { name: 'Jugar' }).click();
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.locator('#ammo')).toHaveText('04');
  expect(await page.evaluate(async () => (await import('/src/main.js')).game.enemies[4].hp)).toBe(1);
  expect(errors).toEqual([]);
});
