import './style.css';
import * as THREE from 'three';
import { Renderer } from './core/Renderer';
import { Engine } from './core/Engine';
import { LightingManager } from './world/LightingManager';
import { Road } from './world/Road';
import { Car } from './vehicle/Car';
import { SoundManager } from './audio/SoundManager';

async function init() {
  const renderer = new Renderer('app');
  const engine = new Engine(renderer);
  
  const lighting = new LightingManager(renderer.scene);
  const road = new Road(renderer.scene);
  const car = new Car(renderer.scene);
  const sound = new SoundManager(renderer.camera);

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const starCount = 5000;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const i3 = i * 3;
    starPos[i3] = (Math.random() - 0.5) * 2000;
    starPos[i3+1] = (Math.random() * 800); 
    starPos[i3+2] = (Math.random() - 0.5) * 2000;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  renderer.scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.5, color: 0xffffff, transparent: true, opacity: 0.8 })));

  const start = document.getElementById('startScreen');
  const flash = document.getElementById('flash');
  const pauseMenu = document.getElementById('pauseMenu');
  const hud = document.getElementById('hud');
  
  let gameStarted = false;
  let isPaused = false;
  let cameraMode: 'CHASE' | 'HOOD' = 'CHASE';

  start?.addEventListener('click', () => {
    if (gameStarted) return;
    gameStarted = true;
    if (flash) {
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 300);
    }
    if (start) start.style.opacity = '0';
    setTimeout(() => { if (start) start.style.display = 'none'; }, 1500);
    if (hud) {
        hud.style.display = 'block';
        setTimeout(() => hud.classList.add('visible'), 10);
    }
    sound.playBGM();
  });

  const keys: any = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = 1;
    if (e.key === 'Escape' && gameStarted) {
        isPaused = !isPaused;
        if (pauseMenu) pauseMenu.style.display = isPaused ? 'flex' : 'none';
        if (hud) hud.style.opacity = isPaused ? '0' : '0.8';
    }
    if (e.key.toLowerCase() === 'c' && gameStarted) {
        cameraMode = cameraMode === 'CHASE' ? 'HOOD' : 'CHASE';
    }
  });
  window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = 0);

  let inputX = 0, currentSpeed = 0, totalDistance = 0;
  const maxSpeed = 40, accel = 10, friction = 6;

  // Asset Loading
  Promise.all([
    car.load('/models/car/chevelle.glb').catch(() => car.load('/models/car/car.glb')),
    sound.loadBGM('/bgm.webm').catch(e => console.warn('BGM skipped', e))
  ]).then(() => {
    const startText = start?.querySelector('.start-text');
    if (startText) startText.innerHTML = 'READY TO IGNITE';
  });

  // 🏎️ Main Engine Update Loop
  engine.onUpdate((delta) => {
    if (!gameStarted || isPaused) return;

    let targetX = (keys.a || keys.arrowleft ? -1 : 0) + (keys.d || keys.arrowright ? 1 : 0);
    inputX = THREE.MathUtils.lerp(inputX, targetX, 0.05);

    const isBraking = keys.s || keys.arrowdown;
    const drive = (keys.w || keys.arrowup ? 1 : 0) - (isBraking ? 1 : 0);
    
    if (drive > 0) currentSpeed += accel * delta;
    else if (drive < 0) currentSpeed -= accel * 2 * delta;
    else currentSpeed -= friction * delta;
    currentSpeed = Math.max(0, Math.min(currentSpeed, maxSpeed));
    totalDistance += currentSpeed * delta;

    const roadInfo = road.getRoadPositionAt(totalDistance);
    const tangent = roadInfo.tangent;
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const carPos = roadInfo.position.clone().add(normal.multiplyScalar(inputX * 6));
    
    if (car.model) {
      car.update(delta, inputX, !!isBraking);
      car.model.position.copy(carPos);
      car.model.lookAt(carPos.clone().add(tangent));
      // Simple ambient light follow
      lighting.update(car.model.position, 0); 
    }
    
    road.update(totalDistance, delta);
    
    renderer.camera.fov = 55 + (currentSpeed / maxSpeed) * 15;
    renderer.camera.updateProjectionMatrix();

    if (cameraMode === 'CHASE') {
        const camInfo = road.getRoadPositionAt(totalDistance - 10);
        const camPos = camInfo.position.clone().add(new THREE.Vector3(0, 2.5, 0)).add(camInfo.tangent.clone().multiplyScalar(-8));
        renderer.camera.position.lerp(camPos, 0.1);
        renderer.camera.lookAt(roadInfo.position.clone().add(new THREE.Vector3(0, 1, 0)));
    } else {
        const hoodPos = carPos.clone().add(new THREE.Vector3(0, 1.2, 0)).add(tangent.clone().multiplyScalar(1));
        renderer.camera.position.lerp(hoodPos, 0.2);
        renderer.camera.lookAt(roadInfo.position.clone().add(tangent.clone().multiplyScalar(50)));
    }

    const speedVal = document.getElementById('speed-val');
    if (speedVal) speedVal.innerText = Math.floor(currentSpeed * 3.6).toString();
    const distVal = document.getElementById('dist-val');
    if (distVal) distVal.innerText = Math.floor(totalDistance).toString();
  });

  engine.start();
}

init();
