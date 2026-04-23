import './style.css';
import * as THREE from 'three';
import { SceneSetup } from './core/SceneSetup';
import { LightingManager } from './core/LightingManager';
import { CarController } from './entities/CarController';
import { RoadManager } from './core/RoadManager';

async function init() {
  const scene = new SceneSetup('app');
  const lighting = new LightingManager(scene.scene);
  const road = new RoadManager(scene.scene);
  const car = new CarController(scene.scene);

  // Speed Reference Props
  const propGroup = new THREE.Group();
  scene.scene.add(propGroup);
  const propSpacing = 80; // More spaced out for cinematic feel
  const propGeo = new THREE.BoxGeometry(0.3, 4, 0.3);
  const reflectorGeo = new THREE.BoxGeometry(0.35, 0.5, 0.35);
  
  const propMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.2 });
  const reflectorMat = new THREE.MeshStandardMaterial({ 
    color: 0xffaa00, 
    emissive: 0xffaa00, 
    emissiveIntensity: 5 
  });

  for (let i = 0; i < 20; i++) {
    const lp = new THREE.Mesh(propGeo, propMat);
    const rp = new THREE.Mesh(propGeo, propMat);
    const lr = new THREE.Mesh(reflectorGeo, reflectorMat);
    const rr = new THREE.Mesh(reflectorGeo, reflectorMat);
    
    lp.position.set(-9, 2, i * propSpacing);
    rp.position.set(9, 2, i * propSpacing);
    lr.position.set(0, 1.5, 0); // Relative to pole
    rr.position.set(0, 1.5, 0);
    
    lp.add(lr); rp.add(rr);
    propGroup.add(lp, rp);
  }

  // Load Assets
  await Promise.all([
    lighting.loadHDR('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr'),
    car.load('/models/car/chevelle.glb').catch(() => car.load('/models/car/car.glb'))
  ]);

  // Input
  const keys: any = { w:0, a:0, s:0, d:0, arrowup:0, arrowdown:0, arrowleft:0, arrowright:0 };
  window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = 1);
  window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = 0);

  let inputX = 0, currentSpeed = 0;
  const maxSpeed = 65, accel = 25, friction = 12;

  scene.render((delta) => {
    // Input
    const targetX = (keys.a || keys.arrowleft ? -1 : 0) + (keys.d || keys.arrowright ? 1 : 0);
    inputX = THREE.MathUtils.lerp(inputX, targetX, 0.1);

    const drive = (keys.w || keys.arrowup ? 1 : 0) - (keys.s || keys.arrowdown ? 1 : 0);
    if (drive > 0) currentSpeed += accel * delta;
    else if (drive < 0) currentSpeed -= accel * 2 * delta;
    else currentSpeed -= friction * delta;
    currentSpeed = Math.max(0, Math.min(currentSpeed, maxSpeed));

    // Update
    car.update(delta, inputX);
    road.speed = currentSpeed;
    road.update(delta);
    lighting.update(car.getPosition(), car.rotationY);

    // Props Loop
    propGroup.position.z -= currentSpeed * delta;
    if (propGroup.position.z < -propSpacing) propGroup.position.z += propSpacing;

    // Camera
    const carPos = car.getPosition();
    scene.camera.fov = 60 + (currentSpeed / maxSpeed) * 10;
    scene.camera.updateProjectionMatrix();
    const camTargetPos = new THREE.Vector3(carPos.x, 2, carPos.z - 6);
    scene.camera.position.lerp(camTargetPos, 0.1);
    scene.camera.lookAt(carPos.x, 1, 20);

    // HUD
    const speedVal = document.getElementById('speed-val');
    if (speedVal) speedVal.innerText = Math.floor(currentSpeed * 3.6).toString();
  });

  const start = document.getElementById('startScreen');
  start?.addEventListener('click', () => {
    if (start) start.style.display = 'none';
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'block';
  });
}

init();
