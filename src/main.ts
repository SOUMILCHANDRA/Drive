import './style.css';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';
import { RoadManager } from './core/RoadManager';
import { WorldManager } from './core/WorldManager';

console.log("Drive: PHASE 3 RECONSTRUCTION - ADDING TERRAIN");

const engine = new Engine();
const car = new Car();
const world = new WorldManager(engine.scene);
const road = new RoadManager(engine.scene, world.getNoise());

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
            world.update(car.mesh.position, (z) => road.getRoadX(z), (x, z) => road.getRoadHeight(x, z));
            road.update(car.mesh.position.z);
            
            if (autopilot) {
                const targetZ = car.mesh.position.z + car.velocityValue * fixedDelta;
                const target = road.getAutopilotTarget(targetZ);
                car.autopilot(target.x, target.z, target.angle, target.y);
            } else {
                car.update(fixedDelta, (x, z) => road.getRoadHeight(x, z));
            }
            
            fixedTimeAccumulator -= fixedDelta;
        }

        // HUD & Stability Logging
        if (Math.random() < 0.01) console.log("Car Y:", car.mesh.position.y);
        
        const speedKmh = Math.floor(car.velocityValue * 3.6);
        distance += car.velocityValue * delta;
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
        }, 200);

        if (startScreen) {
            startScreen.style.opacity = '0';
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
