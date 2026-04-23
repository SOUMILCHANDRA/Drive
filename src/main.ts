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

  // Asset URLs (Using local model with fallback)
  const HDR_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr';
  const CAR_URL = '/models/car/chevelle.glb';
  const FALLBACK_CAR = '/models/car/car.glb';

  // Load assets
  console.log('Loading assets...');
  try {
    await lighting.loadEnvironment(HDR_URL);
  } catch (e) { console.warn("HDR failed", e); }

  try {
    await car.loadModel(CAR_URL);
  } catch (e) {
    console.warn("Chevelle failed, trying generic car...", e);
    try {
        await car.loadModel(FALLBACK_CAR);
    } catch (ee) { console.error("All car models failed", ee); }
  }
  console.log('Asset loading phase complete.');

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
    const cameraOffset = new THREE.Vector3(0, 2.5, -6); // Further back and higher
    const cameraTarget = new THREE.Vector3(0, 0.8, 15); // Look further ahead

    // Position camera behind car
    const targetCamPos = carPos.clone().add(cameraOffset);
    
    sceneSetup.camera.position.lerp(targetCamPos, 0.1);
    sceneSetup.camera.lookAt(carPos.x, 0.8, 15);

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
