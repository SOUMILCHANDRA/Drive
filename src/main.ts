import './style.css';
import { Engine } from './core/Engine';
import { Car } from './entities/Car';
import { WorldManager } from './core/WorldManager';
import { RoadManager } from './core/RoadManager';
import { Stars } from './entities/Stars';
import { SpeedLines } from './entities/SpeedLines';
import { CarTrail } from './entities/CarTrail';
import { AudioEngine } from './core/AudioEngine';
import { Minimap } from './utils/Minimap';
import * as THREE from 'three';

console.log("Neon Drive: Initializing Next-Gen Engine...");

const engine = new Engine();
const car = new Car();
const world = new WorldManager(engine.scene);
const road = new RoadManager(engine.scene, world.getNoise());
const stars = new Stars(engine.scene);
const speedLines = new SpeedLines(engine.scene);
const carTrail = new CarTrail(engine.scene);
const audio = new AudioEngine();
const minimap = new Minimap();

engine.scene.add(car.mesh);

// ATMOSPHERE
engine.scene.fog = new THREE.FogExp2(0x050505, 0.002);

// Initial Placement
car.mesh.position.set(0, 0.5, 0);

const splashElem = document.getElementById('splash');
const hudElem = document.getElementById('hud');
const speedElem = document.getElementById('speed-val');
const distElem = document.getElementById('dist-val');
const elevElem = document.getElementById('elev-val');
const gaugeFill = document.getElementById('gauge-fill');
const boostFill = document.getElementById('boost-fill');
const antiGravWarn = document.getElementById('antigrav-warn');
const flashElem = document.getElementById('flash');

let totalDistance = 0;
let gameStarted = false;
let cinematicIntro = false;
let introTimer = 0;
let boostAmount = 100;

splashElem?.addEventListener('click', () => {
    cinematicIntro = true;
    audio.init();
    splashElem.classList.add('hidden');
});

engine.render((delta) => {
    const speed = Math.abs(car.velocity.z);

    // 1. Core World Updates
    world.update(car.mesh.position);
    road.update(car.mesh.position.z, speed);
    stars.update(car.mesh.position);

    if (gameStarted) {
        // 2. Physics & FX
        car.isAntiGravity = road.isInTunnel(car.mesh.position.z);
        
        if (antiGravWarn) {
            antiGravWarn.style.display = car.isAntiGravity ? 'block' : 'none';
        }

        car.update(delta, (x, z) => road.getRoadHeight(x, z));
        minimap.update(car.mesh.position, car.angle, road.getPoints());
        
        road.updateProps(car.mesh.position, () => {
            car.velocity.z += 15; // 15 m/s burst
            audio.playBoost();
            if (flashElem) flashElem.style.opacity = '1';
        });

        audio.update(speed);

        // Fade flash
        if (flashElem) {
            const currentOp = parseFloat(flashElem.style.opacity || '0');
            flashElem.style.opacity = (currentOp * 0.9).toString();
        }

        speedLines.update(car.mesh.position, speed);
        carTrail.update(car.mesh.position, car.trailColor);

        // 3. HUD Updates
        if (speedElem) speedElem.innerText = Math.round(speed * 3.6).toString();
        
        // Gauge Arc Animation (stroke-dashoffset from 251 to 0)
        if (gaugeFill) {
            const progress = THREE.MathUtils.clamp(speed / car.maxSpeed, 0, 1);
            const offset = 251 - (progress * 251);
            gaugeFill.setAttribute('stroke-dashoffset', offset.toString());
        }

        // Boost logic
        if (boostFill) {
            boostFill.style.width = `${boostAmount}%`;
        }

        totalDistance += speed * delta;
        if (distElem) distElem.innerText = Math.round(totalDistance).toString();
        if (elevElem) elevElem.innerText = Math.round(car.mesh.position.y).toString();

        // 4. Camera Dynamics (FOV & Shake)
        const targetFov = 75 + (speed / car.maxSpeed) * 20;
        engine.camera.fov = THREE.MathUtils.lerp(engine.camera.fov, targetFov, 0.1);
        
        // Horizontal shake at high speed
        if (speed > 50) {
            engine.camera.position.x += (Math.random() - 0.5) * 0.1;
            engine.camera.position.y += (Math.random() - 0.5) * 0.1;
        }
        engine.camera.updateProjectionMatrix();
    }
    
    // 5. Cinematic Intro (Orbital) or Soft Follow
    if (cinematicIntro) {
        introTimer += delta;
        const orbitSpeed = 1.0;
        const radius = 15;
        engine.camera.position.set(
            car.mesh.position.x + Math.sin(introTimer * orbitSpeed) * radius,
            car.mesh.position.y + 5,
            car.mesh.position.z + Math.cos(introTimer * orbitSpeed) * radius
        );
        engine.camera.lookAt(car.mesh.position);

        if (introTimer > 2.0) {
            cinematicIntro = false;
            gameStarted = true;
            if (hudElem) {
                hudElem.style.display = 'flex';
                setTimeout(() => hudElem.classList.add('visible'), 100);
            }
        }
    } else {
        const cameraTarget = car.getCameraTransform();
        engine.camera.position.lerp(cameraTarget.position, gameStarted ? 0.05 : 1.0);
        engine.camera.lookAt(cameraTarget.lookTarget);

        // Subtile high-speed camera shake
        if (speed > 50) {
            engine.camera.position.x += (Math.random() - 0.5) * 0.1;
            engine.camera.position.y += (Math.random() - 0.5) * 0.1;
        }
    }
});
