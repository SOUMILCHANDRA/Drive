import './style.css';
import * as THREE from 'three';
import { Renderer } from './core/Renderer';
import { Engine } from './core/Engine';
import { InputManager } from './core/InputManager';
import { CameraManager } from './core/CameraManager';
import { LightingManager } from './world/LightingManager';
import { SkyManager } from './world/SkyManager';
import { RainSystem } from './world/RainSystem';
import { TrafficManager } from './world/TrafficManager';
import { Road } from './world/Road';
import { Car } from './vehicle/Car';
import { SoundManager } from './audio/SoundManager';
import { QualityManager } from './core/QualitySettings';

// 🛑 Emergency Global Error Handlers for Headless Debugging
window.onerror = (msg, _url, _line, _col, _error) => {
    console.error('CRASH:', msg, 'at', _line, ':', _col, _error);
    const status = document.getElementById('loading-status');
    if (status) status.innerText = `CRASH: ${msg}`;
};
window.onunhandledrejection = (event) => {
    console.error('PROMISE CRASH:', event.reason);
    const status = document.getElementById('loading-status');
    if (status) status.innerText = `PROMISE CRASH: ${event.reason}`;
};

async function init() {
  // 🚦 WebGL 2 Compatibility Check
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2');
  if (!gl) {
    const errorOverlay = document.getElementById('webgl-error');
    if (errorOverlay) errorOverlay.style.display = 'flex';
    return;
  }

  const qualityManager = new QualityManager();
  
  // 📱 Mobile Auto-Tiering
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isMobile) {
      qualityManager.setTier('LOW');
  }
  
  let currentConfig = qualityManager.getConfig();

  const renderer = new Renderer('app', currentConfig);
  const engine = new Engine();
  const input = new InputManager();
  const cameraManager = new CameraManager(renderer.camera);
  
  const lighting = new LightingManager(renderer.scene);
  const sky = new SkyManager(renderer.scene);
  const road = new Road(renderer.scene);
  const car = new Car(renderer.scene);
  const rain = new RainSystem(renderer.scene, currentConfig.rainCount);
  const traffic = new TrafficManager(renderer.scene);
  const sound = new SoundManager();

  const titleScreen = document.getElementById('title-screen');
  const flash = document.getElementById('flash');
  const hud = document.getElementById('hud');
  const biomeLabel = document.getElementById('biome-label');
  const pauseMenu = document.getElementById('pauseMenu');
  const pauseIcon = document.getElementById('pause-icon');
  const camSelect = document.getElementById('camSelect') as HTMLSelectElement;
  const rearview = document.getElementById('rearview');
  const loadingStatus = document.getElementById('loading-status');

  let gameStarted = false;
  let idleTime = 0;
  let currentBiome = "DOWNTOWN";
  let rearviewVisible = false;

  const showBiome = (name: string) => {
      if (!biomeLabel) return;
      biomeLabel.innerText = name;
      biomeLabel.classList.add('visible');
      setTimeout(() => biomeLabel.classList.remove('visible'), 4000);
  };

  const startDrive = () => {
    if (gameStarted || !titleScreen?.classList.contains('ready')) return;
    gameStarted = true;
    document.body.classList.add('game-active');
    
    if (flash) {
        flash.style.opacity = '1';
        setTimeout(() => { flash.style.opacity = '0'; }, 300);
    }
    
    if (titleScreen) titleScreen.classList.add('fade-out');
    if (hud) hud.classList.add('visible');
    
    cameraManager.setMode('CHASE');
    sound.playAll();
    showBiome("DOWNTOWN");
  };

  // 🖱️ Event Orchestration
  window.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter') startDrive(); 
      if (e.key === 'Tab') {
          e.preventDefault();
          rearviewVisible = !rearviewVisible;
          if (rearview) rearview.classList.toggle('visible', rearviewVisible);
      }
  });
  titleScreen?.addEventListener('click', startDrive);

  // 📦 Asset Loading (Failsafe)
  try {
      if (loadingStatus) loadingStatus.innerText = "LOADING METROPOLIS...";
      
      await Promise.all([
        car.load('/models/car.glb').catch(() => {
            console.warn('Primary model failed, attempting fallback...');
            return car.load('/models/car/car.glb');
        }).catch(() => {
            console.error('All model loads failed, using geometric fallback.');
        }),
        sound.loadBGM('/audio/bgm.webm').catch(() => {
            console.warn('BGM failed to load.');
        })
      ]);

      if (car.model) lighting.setupCarLight(car.model);

      if (loadingStatus) loadingStatus.innerText = "SYSTEMS ONLINE";
      setTimeout(() => {
          if (titleScreen) titleScreen.classList.add('ready');
      }, 1000);

  } catch (err) {
      console.error('Initialization error:', err);
      if (loadingStatus) loadingStatus.innerText = "ERROR INITIALIZING SYSTEMS";
  }

  let lastCamToggle = false;

  // 🏎️ Main Engine Update Loop
  engine.onUpdate((delta) => {
    const controls = input.update(delta);
    
    if (pauseMenu) pauseMenu.style.display = controls.pause ? 'flex' : 'none';
    if (pauseIcon) pauseIcon.classList.toggle('visible', controls.pause);
    
    if (!gameStarted) {
        idleTime += delta;
        if (idleTime > 3) cameraManager.setMode('CINEMATIC');
        road.update(0, new THREE.Vector3(0,0,0), 0, delta, currentConfig);
        lighting.update(new THREE.Vector3(0,0,0), 0);
        sky.update(new THREE.Vector3(0,0,0));
        if (car.model) cameraManager.update(delta, car.model, 0);
        renderer.render(delta, 0);
        return;
    }

    if (controls.cameraToggle && !lastCamToggle) {
        cameraManager.cycleMode();
        if (camSelect) camSelect.value = cameraManager.getModeIndex().toString();
    }
    lastCamToggle = controls.cameraToggle;

    const carZ = car.model ? car.model.position.z : 0;
    const roadInfo = road.getRoadPositionAt(carZ);
    const biomeParams = road.biomeManager.getParamsAt(carZ);
    
    const steerTarget = controls.pause ? 0 : controls.steer;
    const throttleTarget = controls.pause ? 0 : controls.throttle;
    const brakeTarget = controls.pause ? 0 : controls.brake;

    car.update(delta, { steer: steerTarget, throttle: throttleTarget, brake: brakeTarget }, roadInfo.position.x, road.getRoadMeshes());
    
    road.update(carZ, car.position, car.speed, delta, currentConfig);
    renderer.updateRoadMirror(car.position);
    lighting.update(car.position, biomeParams.ambientIntensity);
    sky.update(car.position);
    rain.update(delta, car.position, car.speed);
    
    sound.update(car.speed, delta);
    traffic.update(delta, carZ, (z) => road.getRoadPositionAt(z).position.x);
    
    if (car.model) cameraManager.update(delta, car.model, car.speed);

    if (renderer.scene.fog instanceof THREE.FogExp2) {
        renderer.scene.fog.density = THREE.MathUtils.lerp(renderer.scene.fog.density, biomeParams.fogDensity, 0.05);
    }

    renderer.render(delta, steerTarget);
    if (rearviewVisible && car.model) renderer.renderMirror(car.model);

    if (biomeParams.name !== currentBiome) {
        currentBiome = biomeParams.name;
        showBiome(currentBiome);
    }
  });

  engine.start();
}

init().catch(err => {
    console.error('Fatal init error:', err);
    alert('FATAL ERROR: ' + err.message);
});
