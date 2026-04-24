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
import type { QualityTier } from './core/QualitySettings';

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
  const pauseMenu = document.getElementById('pauseMenu');
  const hud = document.getElementById('hud');
  const speedVal = document.getElementById('speed-val');
  const biomeLabel = document.getElementById('biome-label');
  const pauseIcon = document.getElementById('pause-icon');
  const rearview = document.getElementById('rearview');
  
  let gameStarted = false;
  let idleTime = 0;
  let hudUpdateTimer = 0;
  let currentBiome = "HIGHWAY";
  let rearviewVisible = false;

  // 🛠️ Settings UI
  const qualityButtons = document.querySelectorAll('.quality-btn');
  const rainButtons = document.querySelectorAll('.toggle-btn[data-rain]');
  const masterSlider = document.getElementById('masterVol') as HTMLInputElement;
  const camSelect = document.getElementById('camSelect') as HTMLSelectElement;
  const grainCheck = document.getElementById('toggleGrain') as HTMLInputElement;
  const aberrationCheck = document.getElementById('toggleAberration') as HTMLInputElement;

  const updateUI = () => {
      qualityButtons.forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tier') === currentConfig.tier));
      rainButtons.forEach(btn => btn.classList.toggle('active', parseInt(btn.getAttribute('data-rain') || '0') === currentConfig.rainCount));
      if (masterSlider) masterSlider.value = (sound.masterVolume * 100).toString();
      if (camSelect) camSelect.value = cameraManager.getModeIndex().toString();
  };
  updateUI();

  // Listeners
  qualityButtons.forEach(btn => btn.addEventListener('click', () => {
      const tier = btn.getAttribute('data-tier') as QualityTier;
      qualityManager.setTier(tier);
      currentConfig = qualityManager.getConfig();
      renderer.updateQuality(currentConfig);
      rain.updateQuality(currentConfig.rainCount);
      updateUI();
  }));

  rainButtons.forEach(btn => btn.addEventListener('click', () => {
      const count = parseInt(btn.getAttribute('data-rain') || '0');
      currentConfig.rainCount = count;
      rain.updateQuality(count);
      updateUI();
  }));

  masterSlider?.addEventListener('input', (e) => {
      const val = parseInt((e.target as HTMLInputElement).value) / 100;
      sound.setVolume(val);
  });

  camSelect?.addEventListener('change', (e) => {
      const modeIdx = parseInt((e.target as HTMLSelectElement).value);
      cameraManager.setMode(modeIdx);
  });

  grainCheck?.addEventListener('change', (e) => {
      renderer.grainPass.enabled = (e.target as HTMLInputElement).checked;
  });

  aberrationCheck?.addEventListener('change', (e) => {
      renderer.aberrationPass.enabled = (e.target as HTMLInputElement).checked;
  });

  const showBiome = (name: string) => {
      if (!biomeLabel) return;
      biomeLabel.innerText = name;
      biomeLabel.classList.add('active');
      setTimeout(() => biomeLabel.classList.remove('active'), 4000);
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

  window.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter') startDrive(); 
      if (e.key === 'Tab') {
          e.preventDefault();
          rearviewVisible = !rearviewVisible;
          if (rearview) rearview.classList.toggle('visible', rearviewVisible);
      }
  });
  titleScreen?.addEventListener('click', startDrive);

  // Asset Loading
  await Promise.all([
    car.load('/models/car/chevelle.glb').catch(() => car.load('/models/car/car.glb')),
    sound.loadBGM('/audio/bgm.webm').catch(() => {})
  ]);

  // Cinematic Title Reveal
  setTimeout(() => {
    if (titleScreen) titleScreen.classList.add('ready');
  }, 1500);

  let lastCamToggle = false;

  // 🏎️ Main Engine Update Loop
  engine.onUpdate((delta) => {
    const controls = input.update(delta);
    
    if (pauseMenu) pauseMenu.style.display = controls.pause ? 'flex' : 'none';
    if (pauseIcon) pauseIcon.classList.toggle('visible', controls.pause);
    
    if (!gameStarted) {
        idleTime += delta;
        if (idleTime > 3) cameraManager.setMode('CINEMATIC');
        road.update(0, 0, delta, currentConfig);
        lighting.update(new THREE.Vector3(0,0,0), 0);
        sky.update(new THREE.Vector3(0,0,0));
        if (car.model) cameraManager.update(delta, car.model, 0, 0);
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

    car.update(delta, { steer: steerTarget, throttle: throttleTarget, brake: brakeTarget }, roadInfo.position.x);
    
    road.update(carZ, car.speed, delta, currentConfig);
    lighting.update(car.position, biomeParams.ambientIntensity);
    sky.update(car.position);
    rain.update(delta, car.position, car.speed);
    rain.updateQuality(Math.floor(biomeParams.rainIntensity * currentConfig.rainCount));
    
    sound.update(car.speed, delta);
    traffic.update(delta, carZ, (z) => road.getRoadPositionAt(z).position.x);
    
    if (car.model) cameraManager.update(delta, car.model, car.speed, steerTarget);

    if (renderer.scene.fog instanceof THREE.FogExp2) {
        renderer.scene.fog.density = THREE.MathUtils.lerp(renderer.scene.fog.density, biomeParams.fogDensity, 0.05);
    }

    renderer.render(delta, steerTarget);
    if (rearviewVisible && car.model) renderer.renderMirror(car.model);

    // 📊 HUD Throttled Update (10Hz)
    hudUpdateTimer += delta;
    if (hudUpdateTimer > 0.1) {
        if (speedVal) {
            const speedKmh = Math.floor(car.speed * 3.6);
            speedVal.innerText = speedKmh.toString().padStart(3, '0');
        }
        
        if (biomeParams.name !== currentBiome) {
            currentBiome = biomeParams.name;
            showBiome(currentBiome);
        }
        
        hudUpdateTimer = 0;
    }
  });

  engine.start();
}

init();
