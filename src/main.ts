import './style.css';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';
import { WorldManager } from './core/WorldManager';
import { RoadManager } from './core/RoadManager';
import { AudioEngine } from './core/AudioEngine';

console.log("Drive: Cinematic Overhaul Initializing...");

const engine = new Engine();
(window as any).engine = engine;
const car = new Car();

async function bootstrap() {
    // Wait for the car model (and textures) to load
    await car.init();
    
    const world = new WorldManager(engine.scene);
    const road = new RoadManager(engine.scene, world.getNoise());
    const audio = new AudioEngine();

    engine.scene.add(car.mesh);

    const splashElem = document.getElementById('splash');
    const hudElem = document.getElementById('hud');
    const speedElem = document.getElementById('speed-val');
    const distElem = document.getElementById('dist-val');

    let totalDistance = 0;
    let gameStarted = false;

    splashElem?.addEventListener('click', () => {
        gameStarted = true;
        audio.init();
        splashElem.classList.add('hidden');
        if (hudElem) {
            hudElem.style.display = 'block';
            setTimeout(() => hudElem.classList.add('visible'), 500);
        }
    });

    let firstFrame = true;

    engine.render((delta) => {
        const speed = Math.abs(car.velocity.z);

        // 1. Core World Updates
        world.update(car.mesh.position);
        road.update(car.mesh.position.z);

        // 2. Car Updates
        car.update(gameStarted ? delta : 0, (x, z) => road.getRoadHeight(x, z));

        if (gameStarted) {
            audio.update(speed * 0.5); // Quieter engine

            // 3. HUD Updates
            if (speedElem) speedElem.innerText = Math.round(speed * 3.6).toString();
            totalDistance += speed * delta;
            if (distElem) distElem.innerText = Math.round(totalDistance).toString();
        }

        // 4. Cinematic Soft Follow Camera
        const cameraTarget = car.getCameraTransform();
        
        if (firstFrame) {
            engine.camera.position.copy(cameraTarget.position);
            firstFrame = false;
        } else {
            engine.camera.position.lerp(cameraTarget.position, 0.05);
        }
        
        engine.camera.lookAt(cameraTarget.lookTarget);
    });
}

bootstrap();
