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
import type { QualityTier } from './core/QualitySettings';
import { DebugGUI } from './core/DebugGUI';

// Emergency Diagnostic Handlers
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
  const testCanvas = document.createElement('canvas');
  const gl = testCanvas.getContext('webgl2');
  if (!gl) {
    const errorOverlay = document.getElementById('webgl-error');
    if (errorOverlay) errorOverlay.style.display = 'flex';
    return;
  }

  const qualityManager = new QualityManager();
  
  // Mobile Auto-Tiering
  const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isMobile) {
      qualityManager.setTier('LOW');
  }
  
  let currentConfig = qualityManager.getConfig();

  const renderer = new Renderer('app', currentConfig);
  const stats = new Stats();
  stats.dom.style.position = 'absolute';
  stats.dom.style.bottom = '10px';
  stats.dom.style.left = '10px';
  stats.dom.style.top = 'auto';
  stats.dom.style.opacity = '0.6';
  document.body.appendChild(stats.dom);

  const engine = new Engine();
  const input = new InputManager();
  const cameraManager = new CameraManager(renderer.camera);
  
  const lighting = new LightingManager(renderer.scene);
  const sky = new SkyManager(renderer.scene);
  const road = new Road(renderer.scene);
  road.setRoadEnvMap(renderer.getRoadEnvMap());
  const car = new Car(renderer.scene);
  const rain = new RainSystem(renderer.scene, currentConfig.rainCount);
  const traffic = new TrafficManager(renderer.scene);
  const sound = new SoundManager();
  const debugGUI = new DebugGUI(renderer, lighting, road, rain);

  // DOM Elements
  const titleScreen = document.getElementById('title-screen');
  const flash = document.getElementById('flash');
  const hud = document.getElementById('hud');
  const biomeLabel = document.getElementById('biome-label');
  const pauseMenu = document.getElementById('pauseMenu');
  const pauseIcon = document.getElementById('pause-icon');
  const camSelect = document.getElementById('camSelect') as HTMLSelectElement;
  const rearview = document.getElementById('rearview');
  const loadingStatus = document.getElementById('loading-status');
  const speedEl = document.getElementById('speed-val');
  const distEl = document.getElementById('dist-val');
  const fpsEl = document.getElementById('fps-val');
  const callsEl = document.getElementById('calls-val');
  const alertBanner = document.getElementById('alert-banner');
  const masterVol = document.getElementById('masterVol') as HTMLInputElement;

  let gameStarted = false;
  let isReadyToStart = false;
  let pendingStart = false;
  let idleTime = 0;
  let currentBiome = "DOWNTOWN";
  let rearviewVisible = false;
  let alertTimeout: any = null;
  let fpsTimer = 0;
  let frameCount = 0;
  let currentFps = 60;

  const showAlert = (text: string, color: string = '#00ffef') => {
      if (!alertBanner) return;
      alertBanner.innerText = text;
      alertBanner.style.color = color;
      alertBanner.style.display = 'block';
      clearTimeout(alertTimeout);
      alertTimeout = setTimeout(() => {
          alertBanner.style.display = 'none';
      }, 1200);
  };

  const showBiome = (name: string) => {
      if (!biomeLabel) return;
      biomeLabel.innerText = name;
      biomeLabel.classList.add('visible');
      setTimeout(() => biomeLabel.classList.remove('visible'), 4000);
  };

  const startDrive = () => {
    if (gameStarted) return;
    if (!isReadyToStart) {
        pendingStart = true;
        if (loadingStatus) loadingStatus.innerText = "STARTING UPON IGNITION...";
        return;
    }

    gameStarted = true;
    document.body.classList.add('game-active');
    
    if (flash) {
        flash.style.opacity = '0.9';
        setTimeout(() => { flash.style.opacity = '0'; }, 300);
    }
    
    if (titleScreen) titleScreen.classList.add('fade-out');
    if (hud) hud.classList.add('visible');
    
    cameraManager.setMode('CHASE');
    sound.playAll();
    showBiome("DOWNTOWN");
  };

  // ⌨️ Controls & Shortcut Bindings
  window.addEventListener('keydown', (e) => { 
      if (e.key === 'Enter' || e.code === 'Space') startDrive(); 
      if (e.key === 'Tab') {
          e.preventDefault();
          rearviewVisible = !rearviewVisible;
          if (rearview) rearview.classList.toggle('visible', rearviewVisible);
      }
      if (e.key === '1' || e.key.toLowerCase() === 'p') {
          renderer.postProcessingEnabled = !renderer.postProcessingEnabled;
          console.log(`[DEBUG] Post-Processing (Composer): ${renderer.postProcessingEnabled ? 'ENABLED' : 'BYPASSED (Direct WebGL Render)'}`);
          showAlert(`POST-FX: ${renderer.postProcessingEnabled ? 'ON' : 'BYPASSED'}`);
      }
      if (e.key === '2') {
          renderer.toggleShadows();
      }
      if (e.key.toLowerCase() === 'h') {
          debugGUI.gui.show(debugGUI.gui._hidden);
      }
  });

  titleScreen?.addEventListener('click', startDrive);
  titleScreen?.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startDrive();
  }, { passive: false });

  // ─── Settings Dashboard Wire-Up ──────────────────────────────────────────

  // Master Volume
  if (masterVol) {
      masterVol.value = (sound.masterVolume * 100).toString();
      masterVol.addEventListener('input', () => {
          const val = parseFloat(masterVol.value) / 100;
          sound.setVolume(val);
      });
  }

  // Rain Intensity Buttons
  document.querySelectorAll('[data-rain]').forEach(btn => {
      btn.addEventListener('click', () => {
          document.querySelectorAll('[data-rain]').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const count = parseInt((btn as HTMLElement).dataset.rain || '4000');
          rain.setCount(count);
      });
  });

  // Time-of-Day Switcher
  type ToD = 'midnight' | 'sunset' | 'dawn';
  const todPresets: Record<ToD, { fogColor: number; bloomStrength: number }> = {
      midnight: { fogColor: 0x0d0800, bloomStrength: 0.85 },
      sunset:   { fogColor: 0x2a1005, bloomStrength: 1.2 },
      dawn:     { fogColor: 0x0d0a12, bloomStrength: 0.7 },
  };

  document.querySelectorAll('.tod-btn').forEach(btn => {
      btn.addEventListener('click', () => {
          document.querySelectorAll('.tod-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tod = (btn as HTMLElement).dataset.tod as ToD;
          const preset = todPresets[tod];
          if (preset && renderer.scene.fog instanceof THREE.FogExp2) {
              renderer.scene.fog.color.set(preset.fogColor);
              renderer.bloomPass.strength = preset.bloomStrength;
          }
      });
  });

  // Camera Selection Dropdown
  if (camSelect) {
      camSelect.addEventListener('change', () => {
          cameraManager.setMode(parseInt(camSelect.value));
      });
  }

  // Quality Buttons
  document.querySelectorAll('.quality-btn').forEach(btn => {
      btn.addEventListener('click', () => {
          document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const tier = (btn as HTMLElement).dataset.tier as QualityTier;
          if (tier) {
              qualityManager.setTier(tier);
              currentConfig = qualityManager.getConfig();
              renderer.updateQuality(currentConfig);
              rain.setCount(currentConfig.rainCount);
          }
      });
  });

  // Post-FX Toggles
  const grainCheck = document.getElementById('toggleGrain') as HTMLInputElement;
  if (grainCheck) {
      grainCheck.addEventListener('change', () => {
          renderer.setGrainEnabled(grainCheck.checked);
      });
  }

  const aberrationCheck = document.getElementById('toggleAberration') as HTMLInputElement;
  if (aberrationCheck) {
      aberrationCheck.addEventListener('change', () => {
          renderer.setAberrationEnabled(aberrationCheck.checked);
      });
  }

  // Resume Button
  document.querySelector('.resume-btn')?.addEventListener('click', () => {
      input.state.pause = false;
      if (pauseMenu) pauseMenu.style.display = 'none';
      if (pauseIcon) pauseIcon.classList.remove('visible');
  });

  // 📦 Asset Loading (Failsafe & Fast)
  try {
      if (loadingStatus) loadingStatus.innerText = "TUNING V8 ENGINE...";
      
      await car.load('/models/car/car.glb');

      // Load BGM asynchronously without blocking ignition
      sound.loadBGM('/bgm.webm').catch(() => {});

      if (car.model) lighting.setupCarLight(car.model);

      isReadyToStart = true;
      if (titleScreen) titleScreen.classList.add('ready');
      if (loadingStatus) loadingStatus.innerText = "PRESS ENTER OR CLICK TO DRIVE";

      if (pendingStart) {
          startDrive();
      }
  } catch (err) {
      console.error('Initialization fallback trigger:', err);
      isReadyToStart = true;
      if (titleScreen) titleScreen.classList.add('ready');
  }

  let lastCamToggle = false;

  // 🏎️ Main Engine Update Loop
  engine.onUpdate((delta) => {
    const controls = input.update(delta);
    
    if (pauseMenu) pauseMenu.style.display = controls.pause ? 'flex' : 'none';
    if (pauseIcon) pauseIcon.classList.toggle('visible', controls.pause);
    
    if (!gameStarted) {
        idleTime += delta;
        if (idleTime > 2.5) cameraManager.setMode('CINEMATIC');
        road.update(0, new THREE.Vector3(0,0,0), 0, delta, currentConfig);
        lighting.update(new THREE.Vector3(0,0,0), 0.8);
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

    const carZ = car.position.z;
    const roadInfo = road.getRoadPositionAt(carZ);
    const biomeParams = road.biomeManager.getParamsAt(carZ);
    
    const cruiseActive = (document.getElementById('cruiseToggle') as HTMLInputElement)?.checked ?? false;

    // Controls Handling
    const rawSteer    = controls.pause ? 0 : controls.steer;
    const rawThrottle = controls.pause ? 0 : controls.throttle;
    const rawBrake    = controls.pause ? 0 : controls.brake;

    let steerTarget    = rawSteer;
    let throttleTarget = rawThrottle;
    let brakeTarget    = rawBrake;

    if (cruiseActive && !controls.pause) {
        throttleTarget = 0.75;
        brakeTarget    = 0;
        // Automatic gentle road center tracking
        const lateralErr = (roadInfo.position.x - car.position.x) * 0.02;
        steerTarget = THREE.MathUtils.clamp(lateralErr, -0.4, 0.4);
    }

    // Car Kinetics Update
    car.update(delta, { 
        steer: steerTarget, 
        throttle: throttleTarget, 
        brake: brakeTarget 
    }, {
        x: roadInfo.position.x,
        y: roadInfo.position.y,
        tangent: roadInfo.tangent
    });
    
    // World Systems Update
    road.update(carZ, car.position, car.speed, delta, currentConfig);
    renderer.updateRoadReflection(car.position, road.getRoadMeshes(), delta, car.model);
    lighting.update(car.position, biomeParams.ambientIntensity);
    sky.update(car.position);
    rain.update(delta, car.position, car.speed);
    sound.update(car.speed, delta);

    // Traffic Update & Player Interactions
    traffic.update(delta, carZ, (z) => {
        const pos = road.getRoadPositionAt(z).position;
        return { x: pos.x, y: pos.y };
    });

    const interaction = traffic.checkPlayerInteraction(car.position);
    if (interaction.collided) {
        cameraManager.addTrauma(0.65);
        sound.playCollision();
        car.speed = Math.max(0, car.speed * 0.45);
        showAlert("IMPACT!", "#ff3333");
    } else if (interaction.nearMiss) {
        cameraManager.addTrauma(0.2);
        sound.playNearMiss();
        showAlert("NEAR MISS", "#00ffef");
    }
    
    if (car.model) {
        cameraManager.update(delta, car.model, car.speed);
    }

    // Dynamic Fog & Sky Adjustment per Biome
    if (renderer.scene.fog instanceof THREE.FogExp2) {
        renderer.scene.fog.density = THREE.MathUtils.lerp(renderer.scene.fog.density, biomeParams.fogDensity, 0.04);
        renderer.scene.fog.color.lerp(new THREE.Color(biomeParams.fogColor), 0.03);
    }

    // Frame Render
    renderer.render(delta, steerTarget);
    if (rearviewVisible && car.model) {
        renderer.renderMirror(car.model);
    }

    stats.update();

    // ── HUD Readouts ────────────────────────────────────────────────────────
    if (speedEl) {
        const kmh = Math.floor(car.speed * 3.6);
        speedEl.innerText = kmh.toString().padStart(3, '0');
    }
    if (distEl) {
        const distM = Math.floor(car.position.z);
        distEl.innerText = distM >= 1000 ? (distM / 1000).toFixed(1) + ' KM' : distM + ' M';
    }

    frameCount++;
    fpsTimer += delta;
    if (fpsTimer >= 0.2) {
        currentFps = Math.round(frameCount / fpsTimer);
        frameCount = 0;
        fpsTimer = 0;
        if (fpsEl) fpsEl.innerText = currentFps.toString();
        if (callsEl) callsEl.innerText = renderer.renderer.info.render.calls.toString();
    }

    if (biomeParams.name !== currentBiome) {
        currentBiome = biomeParams.name;
        showBiome(currentBiome);
    }
  });

  engine.start();
}

init().catch(err => {
    console.error('Fatal initialization error:', err);
});
