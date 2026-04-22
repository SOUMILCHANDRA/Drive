import './style.css';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';
import { WorldManager } from './core/WorldManager';
import { RoadManager } from './core/RoadManager';
import { Stars } from './entities/Stars';
import { SpeedParticles } from './entities/SpeedParticles';
import * as THREE from 'three';

console.log("Drive: Initializing Core...");

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
    console.log("Drive: Starting Session...");
    gameStarted = true;
    splashElem.classList.add('hidden');
    if (hudElem) {
        hudElem.style.display = 'flex';
        setTimeout(() => hudElem.classList.add('visible'), 100);
    }
});

engine.render((delta) => {
    // 1. Update World Chunks based on car position
    world.update(car.mesh.position);
    
    // 2. Update Procedural Road Chaining (Pass world height for road matching)
    road.update(car.mesh.position.z, (x, z) => world.getHeight(x, z));
    
    // 3. Update Visual FX
    stars.update(car.mesh.position);

    if (gameStarted) {
        // 4. Update Particle effects
        particles.update(car.mesh.position, car.velocity.z);
        
        // 5. Update Car Physics (Use Road Height for grounding)
        car.update(delta, (x, z) => road.getRoadHeight(x, z));

        // 6. Update HUD
        const currentSpeed = Math.abs(car.velocity.z);
        if (speedElem) speedElem.innerText = Math.round(currentSpeed * 3.6).toString();
        
        totalDistance += currentSpeed * delta;
        if (distElem) distElem.innerText = Math.round(totalDistance).toString();
        if (elevElem) elevElem.innerText = Math.round(car.mesh.position.y).toString();
        
        // 7. Dynamic Camera Settings
        engine.camera.fov = 75 + (currentSpeed / car.maxSpeed) * 20;
        engine.camera.updateProjectionMatrix();
    }

    // 8. Static/Cinematic Camera Follow
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
