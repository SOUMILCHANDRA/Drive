import './style.css';
import * as THREE from 'three';
import { SceneSetup } from './core/SceneSetup';
import { LightingManager } from './core/LightingManager';
import { CarController } from './entities/CarController';
import { RoadManager, getWorldX } from './core/RoadManager';
import { TerrainManager } from './core/TerrainManager';
import { PropManager } from './core/PropManager';
import { SoundManager } from './core/SoundManager';

async function init() {
  const scene = new SceneSetup('app');
  const lighting = new LightingManager(scene.scene);
  const road = new RoadManager(scene.scene);
  const car = new CarController(scene.scene);
  const terrain = new TerrainManager(scene.scene);
  const props = new PropManager(scene.scene);
  const sound = new SoundManager(scene.camera);

  // Add High-Fidelity Starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 5000;
  const starPos = new Float32Array(starCount * 3);
  const starColor = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    starPos[i3] = (Math.random() - 0.5) * 1500;
    starPos[i3+1] = (Math.random() * 500); 
    starPos[i3+2] = (Math.random() - 0.5) * 1500;
    starColor[i3] = 0.8 + Math.random() * 0.2;
    starColor[i3+1] = 0.8 + Math.random() * 0.2;
    starColor[i3+2] = 0.9 + Math.random() * 0.1;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starColor, 3));
  const starMat = new THREE.PointsMaterial({ 
    size: 1.8, // Bigger, more sparkly stars
    vertexColors: true, 
    transparent: true, 
    opacity: 0.9,
    sizeAttenuation: true 
  });
  scene.scene.add(new THREE.Points(starGeo, starMat));

  // 1. SETUP INTERACTION IMMEDIATELY
  const start = document.getElementById('startScreen');
  const startText = start?.querySelector('.start-text');
  let gameStarted = false;

  start?.addEventListener('click', () => {
    if (gameStarted) return;
    console.log('Interaction detected - Starting Engine');
    gameStarted = true;
    if (start) start.style.opacity = '0';
    setTimeout(() => { if (start) start.style.display = 'none'; }, 1500);
    
    const hud = document.getElementById('hud');
    if (hud) {
        hud.style.display = 'block';
        setTimeout(() => hud.classList.add('visible'), 10);
    }
    sound.playBGM();
  });

  // 2. LOAD ASSETS IN BACKGROUND
  console.log('Starting background asset load...');
  const assetLoad = Promise.all([
    lighting.loadHDR('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr'),
    car.load('/models/car/chevelle.glb').catch(() => car.load('/models/car/car.glb')),
    sound.loadBGM('/bgm.webm').catch(e => console.warn('BGM skipped', e))
  ]);

  assetLoad.then(() => {
    console.log('All assets loaded');
    if (startText) startText.innerHTML = 'READY TO IGNITE';
  }).catch(err => {
    console.warn('Some assets failed, but engine ready:', err);
    if (startText) startText.innerHTML = 'READY TO IGNITE';
  });

  // Input
  const keys: any = { w:0, a:0, s:0, d:0, arrowup:0, arrowdown:0, arrowleft:0, arrowright:0 };
  window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = 1);
  window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = 0);

  let inputX = 0, currentSpeed = 0, totalDistance = 0;
  const maxSpeed = 50, accel = 15, friction = 8;

  scene.render((delta) => {
    if (!gameStarted) return; // Don't run logic until start

    const targetX = (keys.a || keys.arrowleft ? -1 : 0) + (keys.d || keys.arrowright ? 1 : 0);
    inputX = THREE.MathUtils.lerp(inputX, targetX, 0.08);

    const drive = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    if (drive > 0) currentSpeed += accel * delta;
    else if (drive < 0) currentSpeed -= accel * 2 * delta;
    else currentSpeed -= friction * delta;
    currentSpeed = Math.max(0, Math.min(currentSpeed, maxSpeed));
    totalDistance += currentSpeed * delta;

    const curveAtCar = getWorldX(totalDistance);
    const carVisualX = curveAtCar + (inputX * 4);
    
    if (car.model) {
      car.update(delta, inputX);
      car.model.position.x = carVisualX;
      lighting.update(car.model.position, car.rotationY);
    }
    
    road.speed = currentSpeed;
    road.update(totalDistance, delta);
    terrain.update(totalDistance);
    props.update(totalDistance);
    
    scene.camera.fov = 60 + (currentSpeed / maxSpeed) * 10;
    scene.camera.updateProjectionMatrix();
    const camX = getWorldX(totalDistance - 8) + (inputX * 2);
    scene.camera.position.lerp(new THREE.Vector3(camX, 2.5, -6), 0.1);
    const lookAheadZ = 25;
    const lookX = getWorldX(totalDistance + lookAheadZ);
    scene.camera.lookAt(lookX, 1, lookAheadZ);

    const speedVal = document.getElementById('speed-val');
    if (speedVal) speedVal.innerText = Math.floor(currentSpeed * 3.6).toString();
    const distVal = document.getElementById('dist-val');
    if (distVal) distVal.innerText = Math.floor(totalDistance).toString();
  });
}

init();
