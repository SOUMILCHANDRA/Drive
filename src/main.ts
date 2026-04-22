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

    engine.render((delta) => {
        // Core Logic
        world.update(car.mesh.position, (z) => road.getRoadX(z), (x, z) => road.getRoadHeight(x, z));
        road.update(car.mesh.position.z);

        // Physics
        if (autopilot) {
            // Hard snap car to road spline to prevent drifting
            const targetZ = car.mesh.position.z + car.velocityValue * delta;
            const target = road.getAutopilotTarget(targetZ);
            car.autopilot(target.x, target.z, target.angle, target.y);
        } else {
            car.update(delta, (x, z) => road.getRoadHeight(x, z));
        }

        // HUD Updates
        const speedKmh = Math.floor(car.velocityValue * 3.6);
        distance += car.velocityValue * delta;
        const speedVal = document.getElementById('speed-val');
        const distVal = document.getElementById('dist-val');
        if (speedVal) speedVal.innerText = speedKmh.toString();
        if (distVal) distVal.innerText = Math.floor(distance).toString();

        // Camera
        const cameraTarget = car.getCameraTransform();
        engine.camera.position.lerp(cameraTarget.position, 0.05); // Smoother lag
        engine.camera.lookAt(cameraTarget.lookTarget);
    });

    const splash = document.getElementById('splash');
    const hud = document.getElementById('hud');
    if (splash) {
        splash.addEventListener('click', () => {
            splash.classList.add('hidden');
            if (hud) hud.style.display = 'block';
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'a') {
            autopilot = !autopilot;
            console.log("Autopilot:", autopilot);
        }
    });
}

bootstrap();
