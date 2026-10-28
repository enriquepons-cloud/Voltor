import * as THREE from 'three';
import { MAP, TILE, SETTINGS, center } from './core.js';

// Un dibujo pequeño para los enemigos. El fondo queda transparente.
function createEnemyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#bbbbbb';
  ctx.fillRect(11, 2, 10, 9);
  ctx.fillStyle = '#555555';
  ctx.fillRect(9, 11, 14, 12);
  ctx.fillRect(5, 12, 4, 13);
  ctx.fillRect(23, 12, 4, 13);
  ctx.fillStyle = '#333333';
  ctx.fillRect(10, 23, 5, 9);
  ctx.fillRect(18, 23, 5, 9);
  ctx.fillStyle = '#111111';
  ctx.fillRect(13, 5, 2, 2);
  ctx.fillRect(18, 5, 2, 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  return texture;
}

export function createScene(canvas, game) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // Usar la resolución real, también en las pantallas Retina del Mac.
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.setSize(innerWidth, innerHeight);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x555555);
  const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 100);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
  scene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(10, 20, 5);
  scene.add(light);

  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x999999 });
  const darkMaterial = new THREE.MeshLambertMaterial({ color: 0x444444 });
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
  function box(parent, width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  const size = MAP.length * TILE;
  box(scene, size, 0.2, size, size / 2, -0.1, size / 2, darkMaterial);
  box(scene, size, 0.2, size, size / 2, 3.9, size / 2, darkMaterial);
  const walls = [];
  for (let row = 0; row < MAP.length; row++) {
    for (let col = 0; col < MAP[row].length; col++) {
      if (MAP[row][col] !== '#') continue;
      const position = center(col, row);
      walls.push(box(scene, TILE, 3.8, TILE, position.x, 1.9, position.z, wallMaterial));
    }
  }

  const texture = createEnemyTexture();
  const enemies = game.enemies.map((enemy) => {
    // Sprite siempre orientado hacia la cámara y una caja invisible para los disparos.
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, alphaTest: 0.1 }));
    sprite.scale.set(1.65, 2.15, 1);
    scene.add(sprite);
    const hitbox = box(scene, 0.85, 1.95, 0.55, enemy.x, 1.08, enemy.z, darkMaterial);
    hitbox.visible = false;
    hitbox.userData.enemyId = enemy.id;
    return { sprite, hitbox };
  });

  const pickups = game.pickups.map((item) => {
    const group = new THREE.Group();
    box(group, 0.6, 0.35, 0.45, 0, 0, 0, darkMaterial);
    if (item.type === 'health') {
      box(group, 0.4, 0.08, 0.47, 0, 0, 0, whiteMaterial);
      box(group, 0.08, 0.28, 0.47, 0, 0, 0, whiteMaterial);
    } else {
      for (let x = -1; x <= 1; x++) box(group, 0.06, 0.25, 0.47, x * 0.16, 0, 0, whiteMaterial);
    }
    group.position.set(item.x, 0.3, item.z);
    scene.add(group);
    return group;
  });

  // Cuerpo provisional con un torso y dos piernas.
  const body = new THREE.Group();
  box(body, 0.5, 0.65, 0.3, 0, 1, 0.15, darkMaterial);
  box(body, 0.2, 0.6, 0.25, -0.15, 0.3, 0.15, darkMaterial);
  box(body, 0.2, 0.6, 0.25, 0.15, 0.3, 0.15, darkMaterial);
  scene.add(body);

  // El arma se dibuja aparte para que no atraviese visualmente las paredes.
  const weaponScene = new THREE.Scene();
  const weaponCamera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.01, 10);
  weaponScene.add(new THREE.AmbientLight(0xffffff, 2));
  const weapon = new THREE.Group();
  weapon.position.set(0.22, -0.22, -0.5);
  box(weapon, 0.15, 0.13, 0.4, 0, 0, -0.1, darkMaterial);
  box(weapon, 0.08, 0.08, 0.25, 0, 0.02, -0.4, wallMaterial);
  box(weapon, 0.08, 0.18, 0.1, 0, -0.12, 0, darkMaterial);
  weaponScene.add(weapon);
  const raycaster = new THREE.Raycaster();

  function sync(state) {
    camera.position.set(state.player.x, SETTINGS.eyeHeight, state.player.z);
    camera.rotation.set(state.player.pitch, state.player.yaw, 0, 'YXZ');
    body.position.set(state.player.x, 0, state.player.z);
    body.rotation.y = state.player.yaw;
    state.enemies.forEach((enemy, index) => {
      enemies[index].sprite.visible = enemy.hp > 0;
      enemies[index].sprite.position.set(enemy.x, 1.08, enemy.z);
      enemies[index].hitbox.position.set(enemy.x, 1.08, enemy.z);
    });
    state.pickups.forEach((item, index) => { pickups[index].visible = item.active; });
    scene.updateMatrixWorld(true);
  }

  return {
    renderer,
    shoot(state) {
      sync(state);
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const targets = enemies.filter((enemy, index) => state.enemies[index].hp > 0).map((enemy) => enemy.hitbox);
      const hit = raycaster.intersectObjects([...walls, ...targets], false)[0];
      return hit?.object.userData.enemyId ?? null;
    },
    render(state) {
      sync(state);
      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(weaponScene, weaponCamera);
    },
    resize() {
      camera.aspect = weaponCamera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      weaponCamera.updateProjectionMatrix();
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(innerWidth, innerHeight);
    },
  };
}
