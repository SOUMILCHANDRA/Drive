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

    engine.render((delta) => {
        // Core Logic
        world.update(car.mesh.position, (z) => road.getRoadX(z), (x, z) => road.getRoadHeight(x, z));
        road.update(car.mesh.position.z);

        // Physics
        car.update(delta, (x, z) => road.getRoadHeight(x, z));

        // Camera
        const cameraTarget = car.getCameraTransform();
        engine.camera.position.lerp(cameraTarget.position, 0.1);
        engine.camera.lookAt(cameraTarget.lookTarget);
    });

    const splash = document.getElementById('splash');
    if (splash) splash.style.display = 'none';
}

bootstrap();
