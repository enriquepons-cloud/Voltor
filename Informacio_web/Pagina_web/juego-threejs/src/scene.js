import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MAP, TILE, SETTINGS, center } from './core.js';

const modelLoader = new GLTFLoader();
const modelCache = new Map();
const modelsURL = new URL('../../../assets/Modelos%203D/', import.meta.url);

// Ajusta los modelos de Blender al tamaño del juego y los apoya en el suelo.
function loadModel(path, height, palette) {
  const cacheKey = `${path}:${height}:${palette || ''}`;
  if (!modelCache.has(cacheKey)) {
    const pending = modelLoader.loadAsync(new URL(path, modelsURL).href).then(({ scene: model }) => {
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const middle = bounds.getCenter(new THREE.Vector3());
      const scale = height / Math.max(size.y, 0.001);
      model.scale.setScalar(scale);
      model.position.set(-middle.x * scale, -bounds.min.y * scale, -middle.z * scale);
      const adjustedMaterials = new Set();
      model.traverse((part) => {
        if (!part.isMesh) return;
        part.castShadow = false;
        part.receiveShadow = false;
        if (!part.material) return;
        const materials = Array.isArray(part.material) ? part.material : [part.material];
        for (const material of materials) {
          if (!material.color || adjustedMaterials.has(material)) continue;
          adjustedMaterials.add(material);
          // Sin mapa de entorno, el metal puro de Blender se vería casi negro.
          material.metalness = Math.min(material.metalness ?? 0, 0.15);
          material.roughness = Math.max(material.roughness ?? 1, 0.65);
          const color = material.color;
          if (palette === 'health' && color.r > color.g * 1.4 && color.r > color.b * 1.4) color.set(0x278b45);
          if (palette === 'shield') color.set(color.r + color.g + color.b > 1.2 ? 0x388bea : 0x123c83);
          if (palette === 'ammo') color.set(0xb08a35);
        }
      });
      model.name = `modelo:${path}`;
      return model;
    }).catch((error) => {
      console.warn(`No se pudo cargar ${path}; se usará su figura provisional.`, error);
      throw error;
    });
    modelCache.set(cacheKey, pending);
  }
  return modelCache.get(cacheKey).then((model) => model.clone(true));
}

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
  const modelLoads = [];
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
    // El sprite sirve de respaldo mientras carga el modelo de Blender.
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, alphaTest: 0.1 }));
    sprite.scale.set(1.65, 2.15, 1);
    scene.add(sprite);
    const modelGroup = new THREE.Group();
    modelGroup.name = `enemigo:${enemy.id}`;
    scene.add(modelGroup);
    const hitbox = box(scene, 0.85, 1.95, 0.55, enemy.x, 1.08, enemy.z, darkMaterial);
    hitbox.visible = false;
    hitbox.userData.enemyId = enemy.id;
    const visual = { sprite, modelGroup, hitbox, hitboxY: 1.08 };
    modelLoads.push(loadModel('malvat.glb', 1.95).then((model) => {
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      // La caja de disparo abarca también los brazos y pies del modelo real.
      hitbox.scale.set(size.x / 0.85, size.y / 1.95, size.z / 0.55);
      visual.hitboxY = bounds.getCenter(new THREE.Vector3()).y;
      modelGroup.add(model);
      sprite.visible = false;
      return true;
    }).catch(() => false));
    return visual;
  });

  const pickups = game.pickups.map((item) => {
    const group = new THREE.Group();
    group.name = `suministro:${item.id}`;
    const fallback = new THREE.Group();
    group.add(fallback);
    let modelPath;
    let modelHeight;
    let groundOffset;
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
      fallback.add(new THREE.Mesh(geometry, shieldMaterial));
      for (const z of [-0.03, 0.15]) {
        const face = new THREE.Mesh(new THREE.ShapeGeometry(shape), shieldFaceMaterial);
        face.scale.setScalar(0.8);
        face.position.z = z;
        fallback.add(face);
        box(fallback, 0.065, 0.37, 0.018, 0, -0.005, z, shieldMarkMaterial);
        box(fallback, 0.3, 0.065, 0.018, 0, 0.06, z, shieldMarkMaterial);
      }
      fallback.position.y = 0.5;
      modelPath = 'Escut/Escut.glb'; modelHeight = 0.95; groundOffset = 0.05;
    } else if (item.type === 'health') {
      // Maletín verde con tapa, asa y una cruz blanca a cada lado.
      box(fallback, 0.76, 0.45, 0.4, 0, 0, 0, healthMaterial);
      box(fallback, 0.8, 0.08, 0.44, 0, 0.2, 0, healthLidMaterial);
      box(fallback, 0.06, 0.14, 0.08, -0.14, 0.31, 0, healthMaterial);
      box(fallback, 0.06, 0.14, 0.08, 0.14, 0.31, 0, healthMaterial);
      box(fallback, 0.34, 0.06, 0.08, 0, 0.4, 0, healthLidMaterial);
      for (const z of [-0.21, 0.21]) {
        box(fallback, 0.3, 0.08, 0.025, 0, -0.02, z, whiteMaterial);
        box(fallback, 0.08, 0.28, 0.025, 0, -0.02, z, whiteMaterial);
      }
      fallback.position.y = 0.3;
      modelPath = 'Farmaciola/Farmaciola.glb'; modelHeight = 0.62; groundOffset = 0.02;
    } else {
      // Bala vertical: casquillo amarillo latón y punta marrón cobriza.
      const casing = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.42, 16), brassMaterial);
      casing.position.y = 0.27;
      fallback.add(casing);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16), brassMaterial);
      base.position.y = 0.04;
      fallback.add(base);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 16), brassMaterial);
      neck.position.y = 0.52;
      fallback.add(neck);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 16), copperMaterial);
      tip.position.y = 0.67;
      fallback.add(tip);
      fallback.position.y = 0.015;
      modelPath = 'CaixaBales/CaixaBala.glb'; modelHeight = 0.62; groundOffset = 0.02;
    }
    group.position.set(item.x, groundOffset, item.z);
    modelLoads.push(loadModel(modelPath, modelHeight, item.type).then((model) => {
      fallback.visible = false;
      group.add(model);
      return true;
    }).catch(() => false));
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
      const visual = enemies[index];
      visual.sprite.visible = enemy.hp > 0 && visual.modelGroup.children.length === 0;
      visual.modelGroup.visible = enemy.hp > 0 && visual.modelGroup.children.length > 0;
      enemies[index].sprite.position.set(enemy.x, 1.08, enemy.z);
      visual.modelGroup.position.set(enemy.x, 0, enemy.z);
      // El modelo 3D gira hacia el jugador en lugar de ser un sprite billboarding.
      visual.modelGroup.rotation.y = Math.atan2(state.player.x - enemy.x, state.player.z - enemy.z);
      visual.hitbox.position.set(enemy.x, visual.hitboxY, enemy.z);
      visual.hitbox.rotation.y = visual.modelGroup.rotation.y;
    });
    state.pickups.forEach((item, index) => { pickups[index].visible = item.active; });
    scene.updateMatrixWorld(true);
  }

  return {
    renderer, shotEffects, scene,
    modelsReady: Promise.all(modelLoads),
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
