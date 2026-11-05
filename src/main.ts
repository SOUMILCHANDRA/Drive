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
import { WindshieldSystem } from './world/WindshieldSystem';
import { TrafficManager } from './world/TrafficManager';
import { RoadLanes } from './world/RoadLanes';
import { Road } from './world/Road';
import { Car, HANDLING } from './vehicle/Car';
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
  traffic.setEnvMap(renderer.getRoadEnvMap());
  const sound = new SoundManager();
  const debugGUI = new DebugGUI(renderer, lighting, road, rain);
  (window as any).__scene = renderer.scene;
  (window as any).__road = road;
  (window as any).__renderer = renderer;

  // Expose systems for diagnostics & telemetry
  (window as any).__NIGHTCALL__ = { car, road, input, renderer, cameraManager, traffic, RoadLanes, HANDLING };

  // Spawn car in lane aligned with road tangent using single source of truth (RoadLanes)
  const spawnInitialCar = () => {
      const roadStart = road.getRoadPositionAt(0);
      const tangent = roadStart.tangent.clone().normalize();
      const roadNormal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      const initialLaneOffset = RoadLanes.laneCenterLateralOffset(1, 0); // Lane nearest yellow line on the right (+1.75m)
      const spawnPos = roadStart.position.clone().add(roadNormal.clone().multiplyScalar(initialLaneOffset));
      const initialHeading = Math.atan2(tangent.x, tangent.z);

      car.spawn(spawnPos, initialHeading, initialLaneOffset, road.getRoadMeshes());

      console.log(`[VEHICLE SPAWN] World Pos: (${car.position.x.toFixed(2)}, ${car.position.y.toFixed(2)}, ${car.position.z.toFixed(2)}), Road Center: (${roadStart.position.x.toFixed(2)}, ${roadStart.position.y.toFixed(2)}, ${roadStart.position.z.toFixed(2)}), Lateral Offset: ${initialLaneOffset.toFixed(2)}m`);
  };

  spawnInitialCar();

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
  const loadingBar = document.getElementById('loading-bar');
  const nearMissToast = document.getElementById('near-miss-toast');
  const windshieldCanvas = document.getElementById('windshield-canvas') as HTMLCanvasElement;
  const windshield = windshieldCanvas ? new WindshieldSystem(windshieldCanvas) : null;
  let nearMissTimeout: any = null;
  let lastCollisionTime = 0;

  const updateLoadingProgress = (percent: number, statusText: string) => {
      if (loadingBar) loadingBar.style.width = `${percent}%`;
      if (loadingStatus) loadingStatus.innerText = statusText;
  };

  const speedEl = document.getElementById('speed-val');
  const distEl = document.getElementById('dist-val');
  const fpsEl = document.getElementById('fps-val');
  const callsEl = document.getElementById('calls-val');
  const alertBanner = document.getElementById('alert-banner');
  const masterVol = document.getElementById('masterVol') as HTMLInputElement;

  // F3 Debug Overlay Elements
  const f3Overlay = document.getElementById('f3-debug-overlay');
  const f3OffsetEl = document.getElementById('f3-offset');
  const f3LaneOffsetEl = document.getElementById('f3-lane-offset');
  const f3SpeedEl = document.getElementById('f3-speed');
  const f3SpeedKmhEl = document.getElementById('f3-speed-kmh');
  const f3HeadingEl = document.getElementById('f3-heading');
  const f3HeadingDegEl = document.getElementById('f3-heading-deg');
  const f3SteerEl = document.getElementById('f3-steer');
  const f3OnRoadEl = document.getElementById('f3-onroad');
  const f3LaneIdxEl = document.getElementById('f3-lane-idx');
  const f3OncomingEl = document.getElementById('f3-oncoming');
  const f3SameDirEl = document.getElementById('f3-samedir');
  const f3NearestEl = document.getElementById('f3-nearest');
  const f3ChunksCountEl = document.getElementById('f3-chunks-count');
  const f3NearestChunkEl = document.getElementById('f3-nearest-chunk');
  const f3FarthestChunkEl = document.getElementById('f3-farthest-chunk');
  const f3RoadStatusEl = document.getElementById('f3-road-status');
  let f3OverlayVisible = false;
  let diagLogTimer = 0;

  const applyFloatingOrigin = (offsetZ: number) => {
      car.shiftOrigin(offsetZ);
      cameraManager.shiftOrigin(offsetZ);
      road.shiftOrigin(offsetZ);
      traffic.shiftOrigin(offsetZ);
      rain.shiftOrigin(offsetZ);
      renderer.shiftOrigin(offsetZ);
      console.log(`[FLOATING ORIGIN] Shifted by ${offsetZ.toFixed(1)}m in ONE frame. Total World Z Offset: ${road.worldZOffset}m`);
  };

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
    
    // Smooth transition: fade-in from black on start
    if (flash) {
        flash.style.opacity = '0';
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
      if (e.key === 'F3' || e.code === 'F3') {
          e.preventDefault();
          f3OverlayVisible = !f3OverlayVisible;
          if (f3Overlay) f3Overlay.style.display = f3OverlayVisible ? 'block' : 'none';
          traffic.setDebugVisible(f3OverlayVisible);
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

  // 📦 Asset Loading (Progress bar & Shader Pre-compilation)
  try {
      updateLoadingProgress(25, "CALIBRATING HIGHWAY & TERRAIN...");
      await new Promise(r => setTimeout(r, 60));

      updateLoadingProgress(55, "TUNING V8 ENGINE...");
      await car.load('/models/car/car.glb');
      spawnInitialCar();

      updateLoadingProgress(80, "COMPILING GRAPHICS SHADERS...");
      if (car.model) lighting.setupCarLight(car.model);
      sound.loadBGM('/bgm.webm').catch(() => {});

      // Pre-compile and warm-render 1 frame so the first gameplay frame never hitches or shows broken assets
      renderer.render(0.016, 0);

      updateLoadingProgress(100, "SYSTEMS READY - PRESS ENTER TO BEGIN");
      isReadyToStart = true;
      if (titleScreen) titleScreen.classList.add('ready');

      if (pendingStart) {
          startDrive();
      }
  } catch (err) {
      console.error('Initialization fallback trigger:', err);
      spawnInitialCar();
      updateLoadingProgress(100, "SYSTEMS READY - PRESS ENTER TO BEGIN");
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
        renderer.beginFrame();
        idleTime += delta;
        if (idleTime > 2.5) cameraManager.setMode('CINEMATIC');
        road.update(car.position.z, car.position, 0, delta, currentConfig);
        lighting.update(car.position, 0.8);
        sky.update(car.position);
        if (car.model) cameraManager.update(delta, car.model, 0);
        renderer.render(delta, 0);

        frameCount++;
        fpsTimer += delta;
        if (fpsTimer >= 0.2) {
            currentFps = Math.round(frameCount / fpsTimer);
            frameCount = 0;
            fpsTimer = 0;
            if (fpsEl) fpsEl.innerText = currentFps.toString();
            if (callsEl) callsEl.innerText = renderer.renderer.info.render.calls.toString();
        }
        return;
    }

    if (controls.cameraToggle && !lastCamToggle) {
        cameraManager.cycleMode();
        if (camSelect) camSelect.value = cameraManager.getModeIndex().toString();
    }
    lastCamToggle = controls.cameraToggle;

    // Check Floating Origin: when |player.z| > 2000, shift the origin in ONE function in the same frame
    if (Math.abs(car.position.z) > 2000) {
        applyFloatingOrigin(car.position.z);
    }

    const carZ = car.position.z;
    const totalCarZ = carZ + road.worldZOffset;
    const roadInfo = road.getRoadPositionAt(carZ);
    const biomeParams = road.biomeManager.getParamsAt(totalCarZ);
    
    const cruiseActive = (document.getElementById('cruiseToggle') as HTMLInputElement)?.checked ?? false;

    // Controls Handling
    if (controls.laneAssistToggle) {
        HANDLING.laneAssistEnabled = !HANDLING.laneAssistEnabled;
        showAlert(`LANE ASSIST: ${HANDLING.laneAssistEnabled ? 'ON' : 'OFF'}`, HANDLING.laneAssistEnabled ? '#22e6ff' : '#ff2d95');
    }

    const rawSteer    = controls.pause ? 0 : controls.steer;
    const rawThrottle = controls.pause ? 0 : controls.throttle;
    const rawBrake    = controls.pause ? 0 : controls.brake;

    let steerTarget    = rawSteer;
    let throttleTarget = rawThrottle;
    let brakeTarget    = rawBrake;

    if (cruiseActive && !controls.pause) {
        throttleTarget = 0.75;
        brakeTarget    = 0;
        // Automatic gentle road lane tracking
        const roadTangent = roadInfo.tangent.clone().normalize();
        const roadNormal = new THREE.Vector3(-roadTangent.z, 0, roadTangent.x).normalize();
        const targetX = roadInfo.position.x + roadNormal.x * car.targetLaneOffset;
        const lateralErr = (targetX - car.position.x) * 0.04;
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
        tangent: roadInfo.tangent,
        position: roadInfo.position
    }, road.getRoadMeshes());
    
    // World Systems Update
    renderer.beginFrame();
    road.update(carZ, car.position, car.speed, delta, currentConfig);
    renderer.updateRoadReflection(car.position, road.getRoadMeshes(), delta, car.model);
    lighting.update(car.position, biomeParams.ambientIntensity);
    sky.update(car.position);
    rain.update(delta, car.position, car.speed);
    if (windshield) windshield.update(delta, car.speed, biomeParams.rainIntensity);
    sound.update(car.speed, delta, cameraManager.mode === 'CHASE', biomeParams.rainIntensity);

    // Traffic Update & Player Interactions
    traffic.update(delta, carZ, car.currentLateralOffset, (z) => {
        return road.getRoadPositionAt(z);
    });

    const interaction = traffic.checkPlayerInteraction(car.position);
    if (interaction.collided) {
        lastCollisionTime = performance.now();
        cameraManager.addTrauma(0.65);
        sound.playCollision();
        car.nudgeCollision(Math.random() > 0.5 ? 1 : -1);
        showAlert("IMPACT!", "#ff2d95");
    } else if (interaction.nearMiss) {
        // Never trigger near miss during/immediately after a collision
        if (performance.now() - lastCollisionTime > 1500) {
            cameraManager.addTrauma(0.2);
            sound.playNearMiss();
            // Dedicated NEAR MISS toast: neon pink, 0.9s fade, once per car
            if (nearMissToast) {
                nearMissToast.classList.add('show');
                clearTimeout(nearMissTimeout);
                nearMissTimeout = setTimeout(() => {
                    nearMissToast.classList.remove('show');
                }, 900);
            }
        }
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
        const distM = Math.floor(totalCarZ);
        distEl.innerText = distM >= 1000 ? (distM / 1000).toFixed(1) + ' KM' : distM + ' M';
    }

    // Diagnostic logging for road chunks every 5 seconds
    diagLogTimer += delta;
    if (diagLogTimer >= 5.0) {
        diagLogTimer = 0;
        road.logChunkDiagnostics(car.position.z);
    }

    // F3 Debug Overlay Telemetry Readouts
    if (f3OverlayVisible) {
        if (f3OffsetEl) f3OffsetEl.innerText = car.currentLateralOffset.toFixed(2);
        if (f3LaneOffsetEl) f3LaneOffsetEl.innerText = (car.currentLateralOffset - car.targetLaneOffset).toFixed(2);
        if (f3SpeedEl) f3SpeedEl.innerText = car.speed.toFixed(1);
        if (f3SpeedKmhEl) f3SpeedKmhEl.innerText = Math.round(car.speed * 3.6).toString();
        if (f3HeadingEl) f3HeadingEl.innerText = car.heading.toFixed(3);
        if (f3HeadingDegEl) f3HeadingDegEl.innerText = (car.heading * 180 / Math.PI).toFixed(1);
        if (f3SteerEl) f3SteerEl.innerText = steerTarget.toFixed(2);
        if (f3OnRoadEl) {
            f3OnRoadEl.innerText = car.isOnRoad ? 'TRUE' : 'FALSE';
            f3OnRoadEl.style.color = car.isOnRoad ? '#00ff88' : '#ff3333';
        }

        const playerLaneIdx = RoadLanes.getLaneIndex(1, car.currentLateralOffset);
        if (f3LaneIdxEl) f3LaneIdxEl.innerText = playerLaneIdx.toString();
        if (f3OncomingEl) f3OncomingEl.innerText = traffic.getActiveOncomingCount().toString();
        if (f3SameDirEl) f3SameDirEl.innerText = traffic.getActiveSameDirCount().toString();
        const nearestDist = traffic.getNearestCarDistance(carZ);
        if (f3NearestEl) f3NearestEl.innerText = nearestDist !== null ? nearestDist.toFixed(1) : '--';

        const chunkTelem = road.getChunkTelemetry(carZ);
        if (f3ChunksCountEl) f3ChunksCountEl.innerText = chunkTelem.activeChunks.toString();
        if (f3NearestChunkEl) f3NearestChunkEl.innerText = chunkTelem.nearestDist.toFixed(1);
        if (f3FarthestChunkEl) f3FarthestChunkEl.innerText = '+' + chunkTelem.farthestDist.toFixed(1);
        if (f3RoadStatusEl) {
            f3RoadStatusEl.innerText = chunkTelem.isContinuous ? 'CONTINUOUS (OK)' : 'GAP DETECTED';
            f3RoadStatusEl.style.color = chunkTelem.isContinuous ? '#00ff88' : '#ff3333';
        }
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
