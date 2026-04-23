import './style.css';
import * as THREE from 'three';
import { SceneSetup } from './core/SceneSetup';
import { LightingManager } from './core/LightingManager';
import { CarController } from './entities/CarController';
import { RoadManager } from './core/RoadManager';

/**
 * Main application entry point.
 * Orchestrates the scene, car, and road systems.
 */
async function init() {
  const sceneSetup = new SceneSetup('app');
  const lighting = new LightingManager(sceneSetup.scene);
  const road = new RoadManager(sceneSetup.scene);
  const car = new CarController(sceneSetup.scene);

  // Asset URLs (Using Three.js official examples)
  const HDR_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr';
  const CAR_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/models/gltf/Ferrari.glb';

  // Load assets
  console.log('Loading assets...');
  await Promise.all([
    lighting.loadEnvironment(HDR_URL),
    car.loadModel(CAR_URL)
  ]);
  console.log('Assets loaded.');

  // Input handling
  const keys = { w: false, a: false, s: false, d: false };
  window.addEventListener('keydown', (e) => { if (e.key.toLowerCase() in keys) (keys as any)[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { if (e.key.toLowerCase() in keys) (keys as any)[e.key.toLowerCase()] = false; });

  let inputX = 0;
  const lerpInput = 0.1;

  // Main Render Loop
  sceneSetup.render((delta) => {
    // 1. Process Input
    const targetInputX = (keys.a ? -1 : 0) + (keys.d ? 1 : 0);
    inputX = THREE.MathUtils.lerp(inputX, targetInputX, lerpInput);

    // 2. Update Systems
    car.update(delta, inputX);
    road.update(delta);
    
    // Sync headlights with car
    if (car.model) {
        lighting.updateHeadlights(car.model.position, car.rotationY);
    }

    // 3. Camera Follow Logic
    const carPos = car.getPosition();
    const cameraOffset = new THREE.Vector3(0, 1.8, -4);
    const cameraTarget = new THREE.Vector3(carPos.x * 0.5, 0.5, 10); // Look ahead

    // Position camera behind car
    const idealOffset = cameraOffset.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotationY);
    const targetCamPos = carPos.clone().add(idealOffset);
    
    sceneSetup.camera.position.lerp(targetCamPos, 0.1);
    sceneSetup.camera.lookAt(cameraTarget);

    // 4. Update HUD
    const speedKmh = Math.floor(road.speed * 3.6);
    const speedVal = document.getElementById('speed-val');
    if (speedVal) speedVal.innerText = speedKmh.toString();
  });

  // UI Ignition
  const startScreen = document.getElementById('startScreen');
  startScreen?.addEventListener('click', () => {
    startScreen.style.opacity = '0';
    setTimeout(() => {
        startScreen.style.display = 'none';
        const hud = document.getElementById('hud');
        if (hud) hud.style.display = 'block';
    }, 500);
  });
}

// Start the app
init().catch(console.error);
