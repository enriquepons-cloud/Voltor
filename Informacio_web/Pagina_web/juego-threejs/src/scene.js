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
  const shieldMaterial = new THREE.MeshLambertMaterial({ color: 0x1852b4 });
  const shieldFaceMaterial = new THREE.MeshLambertMaterial({ color: 0x388bea, side: THREE.DoubleSide });
  const shieldMarkMaterial = new THREE.MeshBasicMaterial({ color: 0xd5edff });
  const healthMaterial = new THREE.MeshLambertMaterial({ color: 0x278b45 });
  const healthLidMaterial = new THREE.MeshLambertMaterial({ color: 0x42b567 });
  const brassMaterial = new THREE.MeshLambertMaterial({ color: 0xcba43f });
  const copperMaterial = new THREE.MeshLambertMaterial({ color: 0x946433 });
  function box(parent, width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  const size = MAP.length * TILE;
  const floor = box(scene, size, 0.2, size, size / 2, -0.1, size / 2, darkMaterial);
  const ceiling = box(scene, size, 0.2, size, size / 2, 3.9, size / 2, darkMaterial);
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
    if (item.type === 'shield') {
      // Borde azul oscuro e interior azul claro en las dos caras.
      const shape = new THREE.Shape();
      shape.moveTo(-0.3, 0.3);
      shape.lineTo(0.3, 0.3);
      shape.lineTo(0.26, -0.15);
      shape.lineTo(0, -0.4);
      shape.lineTo(-0.26, -0.15);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, steps: 1 });
      group.add(new THREE.Mesh(geometry, shieldMaterial));
      for (const z of [-0.03, 0.15]) {
        const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), shieldFaceMaterial);
        face.scale.setScalar(0.8);
        face.position.z = z;
        group.add(face);
        box(group, 0.065, 0.37, 0.018, 0, -0.005, z, shieldMarkMaterial);
        box(group, 0.3, 0.065, 0.018, 0, 0.06, z, shieldMarkMaterial);
      }
      group.position.set(item.x, 0.5, item.z);
    } else if (item.type === 'health') {
      // Maletín verde con tapa, asa y una cruz blanca a cada lado.
      box(group, 0.76, 0.45, 0.4, 0, 0, 0, healthMaterial);
      box(group, 0.8, 0.08, 0.44, 0, 0.2, 0, healthLidMaterial);
      box(group, 0.06, 0.14, 0.08, -0.14, 0.31, 0, healthMaterial);
      box(group, 0.06, 0.14, 0.08, 0.14, 0.31, 0, healthMaterial);
      box(group, 0.34, 0.06, 0.08, 0, 0.4, 0, healthLidMaterial);
      for (const z of [-0.21, 0.21]) {
        box(group, 0.3, 0.08, 0.025, 0, -0.02, z, whiteMaterial);
        box(group, 0.08, 0.28, 0.025, 0, -0.02, z, whiteMaterial);
      }
      group.position.set(item.x, 0.3, item.z);
    } else {
      // Bala vertical: casquillo amarillo latón y punta marrón cobriza.
      const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 16), brassMaterial);
      casing.position.y = 0.27;
      group.add(casing);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16), brassMaterial);
      base.position.y = 0.04;
      group.add(base);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 16), brassMaterial);
      neck.position.y = 0.52;
      group.add(neck);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 16), copperMaterial);
      tip.position.y = 0.67;
      group.add(tip);
      group.position.set(item.x, 0.015, item.z);
    }
    scene.add(group);
    return group;
  });

  // Cuerpo provisional con un torso y dos piernas.
  const body = new THREE.Group();
  box(body, 0.5, 0.65, 0.3, 0, 1, 0.15, darkMaterial);
  box(body, 0.2, 0.6, 0.25, -0.15, 0.3, 0.15, darkMaterial);
  box(body, 0.2, 0.6, 0.25, 0.15, 0.3, 0.15, darkMaterial);
  scene.add(body);

  // Las manos se dibujan aparte para que no se recorten contra las paredes.
  const handsScene = new THREE.Scene();
  const handsCamera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.01, 5);
  handsScene.add(new THREE.AmbientLight(0xffffff, 1.5));
  const handsLight = new THREE.DirectionalLight(0xffffff, 2);
  handsLight.position.set(-2, 3, 1);
  handsScene.add(handsLight);
  const skinMaterial = new THREE.MeshLambertMaterial({ color: 0xc39a72 });
  const sleeveMaterial = new THREE.MeshLambertMaterial({ color: 0x50534d });
  const cuffMaterial = new THREE.MeshLambertMaterial({ color: 0x30332f });
  for (const side of [-1, 1]) {
    const hand = new THREE.Group();
    // Postura de sujeción: mano derecha atrás y mano izquierda de apoyo delante.
    hand.position.set(side === 1 ? 0.23 : 0.08, side === 1 ? -0.19 : -0.22, side === 1 ? -0.58 : -0.75);
    hand.rotation.set(0, side === 1 ? 0.05 : -0.55, side === 1 ? -0.12 : 0.3);
    hand.scale.setScalar(0.85);
    // Manga, puño y muñeca.
    const sleeve = box(hand, 0.15, 0.14, 0.38, side * 0.025, -0.075, 0.28, sleeveMaterial);
    sleeve.rotation.x = -0.25;
    box(hand, 0.14, 0.13, 0.065, 0, -0.02, 0.1, cuffMaterial);
    box(hand, 0.1, 0.095, 0.08, 0, -0.005, 0.05, skinMaterial);
    // Palma, cuatro dedos doblados y pulgar hacia el centro de la pantalla.
    box(hand, 0.13, 0.11, 0.14, 0, 0, -0.04, skinMaterial);
    for (let finger = 0; finger < 4; finger++) {
      box(hand, 0.027, 0.085, 0.065, -0.048 + finger * 0.032, 0.01, -0.13, skinMaterial);
    }
    const thumb = box(hand, 0.05, 0.07, 0.09, -side * 0.075, -0.015, -0.04, skinMaterial);
    thumb.rotation.z = side * 0.35;
    handsScene.add(hand);
  }

  const raycaster = new THREE.Raycaster();
  // Estelas cortas para ver los disparos aunque todavía no haya arma.
  const shotEffects = new THREE.Group();
  shotEffects.name = 'disparos';
  scene.add(shotEffects);
  const tracerGeometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 6);
  const tracerMaterial = new THREE.MeshBasicMaterial({ color: 0xffdc80 });
  const impactGeometry = new THREE.SphereGeometry(0.065, 8, 6);
  const impactMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1bd });
  const shots = [];

  function showShot(end) {
    const start = new THREE.Vector3(0.16, -0.14, -0.3).applyQuaternion(camera.quaternion).add(camera.position);
    const direction = end.clone().sub(start);
    const effect = new THREE.Group();
    const tracer = new THREE.Mesh(tracerGeometry, tracerMaterial);
    tracer.position.copy(start).lerp(end, 0.5);
    tracer.scale.y = direction.length();
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    effect.add(tracer);
    const impact = new THREE.Mesh(impactGeometry, impactMaterial);
    impact.position.copy(end);
    effect.add(impact);
    shotEffects.add(effect);
    shots.push({ effect, remaining: 0.14 });
  }

  function clearShots() {
    shotEffects.clear();
    shots.length = 0;
  }

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
    renderer, shotEffects,
    reset: clearShots,
    shoot(state) {
      sync(state);
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const targets = enemies.filter((enemy, index) => state.enemies[index].hp > 0).map((enemy) => enemy.hitbox);
      const hit = raycaster.intersectObjects([...walls, floor, ceiling, ...targets], false)[0];
      const end = hit ? hit.point : raycaster.ray.at(60, new THREE.Vector3());
      showShot(end);
      return hit?.object.userData.enemyId ?? null;
    },
    render(state, dt = 0) {
      sync(state);
      for (let i = shots.length - 1; i >= 0; i--) {
        shots[i].remaining -= dt;
        if (shots[i].remaining <= 0) {
          shotEffects.remove(shots[i].effect);
          shots.splice(i, 1);
        }
      }
      renderer.autoClear = true;
      renderer.render(scene, camera);
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.render(handsScene, handsCamera);
    },
    resize() {
      camera.aspect = handsCamera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      handsCamera.updateProjectionMatrix();
      renderer.setPixelRatio(window.devicePixelRatio || 1);
      renderer.setSize(innerWidth, innerHeight);
    },
  };
}
