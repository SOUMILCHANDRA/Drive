import './style.css';
import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';
import { RoadManager } from './core/RoadManager';
import { Noise } from './utils/Noise';

console.log("Drive: PHASE 2 RECONSTRUCTION - ADDING ROAD");

const engine = new Engine();
const car = new Car();
const noise = new Noise(Math.random());

async function bootstrap() {
    await car.init();
    
    // Road Manager integration
    const road = new RoadManager(engine.scene, noise);
    engine.scene.add(car.mesh);

    engine.render((delta) => {
        // Keep the debug cube
        const cube = engine.scene.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry && child.geometry.parameters.width === 2);
        if (cube) {
            cube.rotation.x += delta;
            cube.rotation.y += delta;
        }

        // Road update
        road.update(car.mesh.position.z);

        // Update car with road height
        car.update(delta, (x, z) => road.getRoadHeight(x, z));

        // Camera follow
        const cameraTarget = car.getCameraTransform();
        engine.camera.position.lerp(cameraTarget.position, 0.1);
        engine.camera.lookAt(cameraTarget.lookTarget);
    });

    const splash = document.getElementById('splash');
    if (splash) splash.style.display = 'none';
}

bootstrap();
