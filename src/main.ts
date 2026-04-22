import './style.css';
import * as THREE from 'three';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';

console.log("Drive: PHASE 1 RECONSTRUCTION - ADDING CAR");

const engine = new Engine();
const car = new Car();

async function bootstrap() {
    await car.init();
    engine.scene.add(car.mesh);

    engine.render((delta) => {
        // Keep the debug cube rotating
        const cube = engine.scene.children.find(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry && child.geometry.parameters.width === 2);
        if (cube) {
            cube.rotation.x += delta;
            cube.rotation.y += delta;
        }

        // Update car (no terrain height for now, just flat)
        car.update(delta, () => 0);

        // Basic camera follow
        const cameraTarget = car.getCameraTransform();
        engine.camera.position.lerp(cameraTarget.position, 0.1);
        engine.camera.lookAt(cameraTarget.lookTarget);
    });

    const splash = document.getElementById('splash');
    if (splash) splash.style.display = 'none';
}

bootstrap();
