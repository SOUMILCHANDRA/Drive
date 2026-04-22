import './style.css';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';
import { WorldManager } from './core/WorldManager';
import { RoadManager } from './core/RoadManager';
import { AudioEngine } from './core/AudioEngine';
import * as THREE from 'three';

console.log("Drive: Cinematic Overhaul Initializing...");

const engine = new Engine();
const car = new Car();
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

engine.render((delta) => {
    const speed = Math.abs(car.velocity.z);

    // 1. Core World Updates
    world.update(car.mesh.position);
    road.update(car.mesh.position.z);

    // 2. Car Updates (Always update logic/lights, physics only if gameStarted)
    car.update(gameStarted ? delta : 0, (x, z) => road.getRoadHeight(x, z));

    if (gameStarted) {
        audio.update(speed * 0.5); // Quieter engine

        // 3. HUD Updates (Minimalist)
        if (speedElem) speedElem.innerText = Math.round(speed * 3.6).toString();
        totalDistance += speed * delta;
        if (distElem) distElem.innerText = Math.round(totalDistance).toString();
    }

    // 4. Cinematic Soft Follow Camera
    const cameraTarget = car.getCameraTransform();
    
    // Slower, smoother lerp for cinema feel
    engine.camera.position.lerp(cameraTarget.position, 0.03);
    
    // Smooth LookAt
    engine.camera.lookAt(cameraTarget.lookTarget);
});
