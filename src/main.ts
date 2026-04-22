import './style.css';
import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';
import { RoadManager } from './core/RoadManager';
import { WorldManager } from './core/WorldManager';
import { TerrainManager } from './core/TerrainManager';

console.log("Drive: PHASE 1 RECONSTRUCTION - INFINITE RUNNER LOOP");

// EMERGENCY DEBUG: Display errors on screen if black
window.onerror = function(msg, url, line, col, error) {
    const debug = document.createElement('div');
    debug.style.position = 'fixed';
    debug.style.top = '0';
    debug.style.left = '0';
    debug.style.background = 'rgba(255,0,0,0.9)';
    debug.style.color = 'white';
    debug.style.zIndex = '9999';
    debug.style.padding = '20px';
    debug.style.fontFamily = 'monospace';
    debug.innerText = `ERROR: ${msg}\nLine: ${line}\nCol: ${col}\nStack: ${error?.stack}`;
    document.body.appendChild(debug);
    return false;
};

const engine = new Engine();
const worldGroup = new THREE.Group();
engine.scene.add(worldGroup);

const car = new Car();
const world = new WorldManager(worldGroup);
const road = new RoadManager(worldGroup, world.getNoise());
const terrain = new TerrainManager(worldGroup, world.getNoise(), road);

async function bootstrap() {
    await car.init();
    engine.scene.add(car.mesh);

    let distance = 0;
    let autopilot = false; // Manual by default
    let fixedTimeAccumulator = 0;
    const fixedDelta = 1 / 60;

    engine.render((delta) => {
        fixedTimeAccumulator += delta;
        
        while (fixedTimeAccumulator >= fixedDelta) {
            // FIXED PHYSICS UPDATE (60Hz)
            const roadX = road.getRoadX(distance);
            const roadY = road.getRoadHeight(roadX, distance);
            const roadTangent = road.getTangent(distance);

            if (autopilot) {
                car.autopilot(roadX, roadY, roadTangent);
            } else {
                car.update(fixedDelta, roadX, roadY, roadTangent);
            }
            
            distance += car.velocityValue * fixedDelta;

            // VIRTUAL WORLD GENERATION
            // The world managers generate geometry at virtual absolute coordinates
            const virtualPos = new THREE.Vector3(car.mesh.position.x, 0, distance);
            
            world.update(virtualPos, (z) => road.getRoadX(z), (x, z) => road.getRoadHeight(x, z));
            terrain.update(virtualPos);
            road.update(distance);

            // INFINITE RUNNER ILLUSION
            // The entire world group moves backward as we travel forward
            worldGroup.position.z = -distance;
            
            fixedTimeAccumulator -= fixedDelta;
        }

        // HUD & Stability Logging
        if (Math.random() < 0.01) console.log("Car Y:", car.mesh.position.y);
        
        const speedKmh = Math.floor(car.velocityValue * 3.6);
        const speedVal = document.getElementById('speed-val');
        const distVal = document.getElementById('dist-val');
        if (speedVal) speedVal.innerText = speedKmh.toString();
        if (distVal) distVal.innerText = Math.floor(distance).toString();

        // Spring-Arm Camera Follow (Interpolated)
        const cameraTarget = car.getCameraTransform();
        if (cameraTarget && !isNaN(cameraTarget.position.x)) {
            engine.camera.position.copy(cameraTarget.position); // Spring-arm handles damping
            engine.camera.lookAt(cameraTarget.lookTarget);
        } else {
            engine.camera.position.set(0, 15, 25);
            engine.camera.lookAt(0, 0, 0);
        }
    });

    let audioStarted = false;
    const startScreen = document.getElementById('startScreen');
    const hud = document.getElementById('hud');

    function playAudio() {
        if (audioStarted) return;
        const audio = new Audio('bgm.webm'); // Fallback to verified file
        audio.loop = true;
        audio.volume = 0.5;
        audio.play().catch(e => console.warn("Audio ignition failed:", e));
        audioStarted = true;
    }

    startScreen?.addEventListener('click', () => {
        // AUDIO-VISUAL SYNC: Cinematic ignition
        setTimeout(() => {
            playAudio();
            engine.ignite(); // Trigger the 3D power-on ramp
        }, 200);

        if (startScreen) {
            startScreen.style.opacity = '0';
            startScreen.style.transform = 'scale(1.1)'; // Pulse-out effect
        }

        setTimeout(() => {
            if (startScreen) startScreen.style.display = 'none';
            if (hud) {
                hud.style.display = 'block';
                hud.classList.add('visible');
            }
        }, 1000);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'a') {
            autopilot = !autopilot;
            console.log("Autopilot:", autopilot);
        }
    });
}

bootstrap();
