import './style.css';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';
import { WorldManager } from './core/WorldManager';
import { RoadManager } from './core/RoadManager';
import { Stars } from './entities/Stars';
import { SpeedParticles } from './entities/SpeedParticles';
import * as THREE from 'three';

console.log("Drive: Initializing...");

const engine = new Engine();
const car = new Car();
const world = new WorldManager(engine.scene);
const road = new RoadManager(engine.scene, world.getNoise());
const stars = new Stars(engine.scene);
const particles = new SpeedParticles(engine.scene);

engine.scene.add(car.mesh);

// ATMOSPHERE
engine.scene.fog = new THREE.FogExp2(0x050505, 0.005);
engine.renderer.setClearColor(0x0a0a0a);

// Initial Car Placement
car.mesh.position.set(0, 0.5, 0);

const splashElem = document.getElementById('splash');
const hudElem = document.getElementById('hud');
const speedElem = document.getElementById('speed-val');
const distElem = document.getElementById('dist-val');
const elevElem = document.getElementById('elev-val');

let totalDistance = 0;
let gameStarted = false;

splashElem?.addEventListener('click', () => {
    gameStarted = true;
    splashElem.classList.add('hidden');
    if (hudElem) {
        hudElem.style.display = 'flex';
        setTimeout(() => hudElem.classList.add('visible'), 100);
    }
});

engine.render((delta) => {
    // Background updates
    world.update(car.mesh.position);
    road.update(car.mesh.position.z, (x, z) => world.getHeight(x, z));
    stars.update(car.mesh.position);

    if (gameStarted) {
        particles.update(car.mesh.position, car.velocity.z);
        car.update(delta, (x, z) => road.getRoadHeight(x, z));

        const currentSpeed = Math.abs(car.velocity.z);
        if (speedElem) speedElem.innerText = Math.round(currentSpeed * 3.6).toString();
        
        totalDistance += currentSpeed * delta;
        if (distElem) distElem.innerText = Math.round(totalDistance).toString();
        if (elevElem) elevElem.innerText = Math.round(car.mesh.position.y).toString();
        
        engine.camera.fov = 75 + (currentSpeed / car.maxSpeed) * 20;
        engine.camera.updateProjectionMatrix();
    }

    // Camera
    const speed = gameStarted ? Math.abs(car.velocity.z) : 0;
    const offset = new THREE.Vector3(
        Math.sin(car.angle) * -15, 
        6 + (speed / 20), 
        Math.cos(car.angle) * -15
    );
    const targetCamPos = car.mesh.position.clone().add(offset);
    engine.camera.position.lerp(targetCamPos, gameStarted ? 0.05 : 1.0);
    
    const lookTarget = car.mesh.position.clone().add(
        new THREE.Vector3(Math.sin(car.angle) * 10, 2, Math.cos(car.angle) * 10)
    );
    engine.camera.lookAt(lookTarget);
});
