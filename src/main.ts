import './style.css';
import * as THREE from 'three';
import Stats from 'three/examples/jsm/libs/stats.module.js';
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
  const stats = new Stats();
  document.body.appendChild(stats.dom);
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
      if (e.key === '1') {
          renderer.postProcessingEnabled = !renderer.postProcessingEnabled;
          console.log('PostProcessing:', renderer.postProcessingEnabled);
      }
      if (e.key === '2') {
          const enabled = renderer.toggleShadows();
          renderer.scene.traverse((c: any) => {
              if (c.isMesh) {
                  if (c._origCast === undefined) c._origCast = c.castShadow;
                  if (c._origReceive === undefined) c._origReceive = c.receiveShadow;
                  c.castShadow = enabled ? c._origCast : false;
                  c.receiveShadow = enabled ? c._origReceive : false;
              }
          });
          console.log('Shadows:', enabled);
      }
      if (e.key === '3') {
          if (renderer.scene.fog) {
              (renderer.scene as any)._oldFog = renderer.scene.fog;
              renderer.scene.fog = null;
              console.log('Fog: OFF');
          } else if ((renderer.scene as any)._oldFog) {
              renderer.scene.fog = (renderer.scene as any)._oldFog;
              console.log('Fog: ON');
          }
      }
  });
  titleScreen?.addEventListener('click', startDrive);

  // ── Time-of-Day Switcher ──────────────────────────────────────────────
  type ToD = 'midnight' | 'sunset' | 'dawn';
  const todPresets: Record<ToD, { fogColor: number; ambientColor: number; ambientIntensity: number; bloomStrength: number }> = {
      midnight: { fogColor: 0x0d0800, ambientColor: 0x3d1f05, ambientIntensity: 1.2, bloomStrength: 0.9 },
      sunset:   { fogColor: 0x2a1005, ambientColor: 0x6b2a05, ambientIntensity: 2.2, bloomStrength: 1.4 },
      dawn:     { fogColor: 0x0d0a12, ambientColor: 0x1a0d28, ambientIntensity: 0.8, bloomStrength: 0.7 },
  };

  document.querySelectorAll('.tod-btn').forEach(btn => {
      btn.addEventListener('click', () => {
          document.querySelectorAll('.tod-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tod = (btn as HTMLElement).dataset.tod as ToD;
          const preset = todPresets[tod];
          if (preset && renderer.scene.fog instanceof THREE.FogExp2) {
              renderer.scene.fog.color.set(preset.fogColor);
          }
          renderer.bloomPass.strength = preset.bloomStrength;
      });
  });

  // 📦 Asset Loading (Failsafe)
  try {
      if (loadingStatus) loadingStatus.innerText = "LOADING METROPOLIS...";
      console.log('DEBUG: Before Promise.all');
      
      await Promise.all([
        car.load('/models/car/car.glb').catch((e) => {
            console.error('DEBUG: All model loads failed, using geometric fallback.', e);
        })
      ]);

      console.log('DEBUG: After Promise.all');

      // Load BGM asynchronously without blocking the start of the game
      sound.loadBGM('/bgm.webm').catch((e) => {
          console.warn('DEBUG: BGM failed to load.', e);
      });

      console.log('DEBUG: Setting up lights');

      if (car.model) lighting.setupCarLight(car.model);

      console.log('DEBUG: Setting SYSTEMS ONLINE');
      if (loadingStatus) loadingStatus.innerText = "SYSTEMS ONLINE";
      setTimeout(() => {
          console.log('DEBUG: Adding ready class');
          if (titleScreen) titleScreen.classList.add('ready');
          if (loadingStatus) loadingStatus.innerText = "PRESS ENTER TO START";
      }, 1000);

  } catch (err) {
      console.error('DEBUG: Initialization error:', err);
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
        console.log("RENDER:", JSON.stringify(renderer.renderer.info.render));
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
    
    const cruiseActive = (document.getElementById('cruiseToggle') as HTMLInputElement)?.checked ?? false;

    // Cruise control: auto-throttle + gentle road-following steer
    const rawSteer    = controls.pause ? 0 : controls.steer;
    const rawThrottle = controls.pause ? 0 : controls.throttle;
    const rawBrake    = controls.pause ? 0 : controls.brake;

    let steerTarget    = rawSteer;
    let throttleTarget = rawThrottle;
    let brakeTarget    = rawBrake;

    if (cruiseActive && !controls.pause) {
        throttleTarget = 0.65; // gentle cruise throttle
        brakeTarget    = 0;
        // Nudge toward road center automatically
        const lateralErr = (roadInfo.position.x - (car.model?.position.x ?? 0)) * 0.018;
        steerTarget = THREE.MathUtils.clamp(lateralErr, -0.4, 0.4);
    }

    car.update(delta, { steer: steerTarget, throttle: throttleTarget, brake: brakeTarget }, roadInfo.position.x, road.getRoadMeshes());
    
    road.update(carZ, car.position, car.speed, delta, currentConfig);
    renderer.updateRoadMirror(car.position);
    lighting.update(car.position, biomeParams.ambientIntensity);
    sky.update(car.position);
    rain.update(delta, car.position, car.speed);
    
    sound.update(car.speed, delta);
    traffic.update(delta, carZ, (z) => {
        const pos = road.getRoadPositionAt(z).position;
        return { x: pos.x, y: pos.y };
    });
    
    if (car.model) cameraManager.update(delta, car.model, car.speed);

    if (renderer.scene.fog instanceof THREE.FogExp2) {
        renderer.scene.fog.density = THREE.MathUtils.lerp(renderer.scene.fog.density, biomeParams.fogDensity, 0.05);
        renderer.scene.fog.color.lerp(new THREE.Color(biomeParams.fogColor), 0.04);
        renderer.scene.background = renderer.scene.fog.color.clone().multiplyScalar(0.3);
    }

    renderer.render(delta, steerTarget);
    if (rearviewVisible && car.model) renderer.renderMirror(car.model);

    stats.update();
    console.log(JSON.stringify(renderer.renderer.info.render));

    // ── Speed HUD ──────────────────────────────────────────────────────
    const speedEl = document.getElementById('speed-val');
    if (speedEl) speedEl.innerText = Math.floor(car.speed * 6).toString().padStart(3, '0');

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
