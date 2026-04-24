import * as THREE from 'three';

/**
 * TrafficVehicle: A high-intensity, performance-optimized oncoming light rig.
 */
class TrafficVehicle {
    public mesh: THREE.Group;
    public active: boolean = false;
    public speed: number = 0;
    public currentZ: number = 0;
    public laneX: number = -5; // Oncoming Lane

    private billboard: THREE.Group;
    private lights: THREE.PointLight[] = [];
    private emissiveMaterials: THREE.MeshStandardMaterial[] = [];

    constructor() {
        this.mesh = new THREE.Group();
        this.billboard = new THREE.Group();
        
        const geo = new THREE.PlaneGeometry(0.3, 0.15);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xfff8e7,
            emissive: 0xfff8e7,
            emissiveIntensity: 8,
            toneMapped: false
        });
        this.emissiveMaterials.push(mat);

        // Dual Headlights
        const leftLight = new THREE.Mesh(geo, mat);
        leftLight.position.x = -0.6;
        const rightLight = new THREE.Mesh(geo, mat.clone());
        rightLight.position.x = 0.6;
        this.emissiveMaterials.push(rightLight.material as THREE.MeshStandardMaterial);
        
        this.billboard.add(leftLight, rightLight);
        this.billboard.position.y = 0.6;
        this.mesh.add(this.billboard);

        // Ground Splash
        const light = new THREE.PointLight(0xfff8e7, 3, 40);
        light.position.set(0, 0.5, 0.5);
        this.mesh.add(light);
        this.lights.push(light);
    }

    public spawn(z: number, x: number, speed: number): void {
        this.currentZ = z;
        this.laneX = x;
        this.speed = speed;
        this.active = true;
        this.mesh.visible = true;
        this.mesh.position.set(x, 0, z);
    }

    public update(playerZ: number): void {
        if (!this.active) return;
        
        const dist = this.currentZ - playerZ;
        
        // 1. Bloom Spike Effect (Brighter when close)
        const spikeFactor = dist < 40 ? THREE.MathUtils.mapLinear(Math.max(0, dist), 0, 40, 15, 8) : 8;
        this.emissiveMaterials.forEach(m => m.emissiveIntensity = spikeFactor);
        
        // 2. Point Light Proximity Fade
        const intensity = dist < 2 ? 0 : 3; // Kill light as it passes to avoid "leaking" behind camera
        this.lights.forEach(l => l.intensity = intensity);
    }

    public deactivate(): void {
        this.active = false;
        this.mesh.visible = false;
    }
}

/**
 * TrafficManager: Manages a pool of oncoming traffic vehicles.
 */
export class TrafficManager {
    private scene: THREE.Scene;
    private pool: TrafficVehicle[] = [];
    private activeCars: TrafficVehicle[] = [];
    private maxCars: number = 8;
    private lastSpawnZ: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        for (let i = 0; i < this.maxCars; i++) {
            const car = new TrafficVehicle();
            this.scene.add(car.mesh);
            car.deactivate();
            this.pool.push(car);
        }
    }

    public update(delta: number, playerZ: number, getRoadX: (z: number) => number): void {
        // 1. Spawning Logic (Oncoming)
        if (playerZ - this.lastSpawnZ > 200 && this.activeCars.length < this.maxCars) {
            const car = this.pool.find(c => !c.active);
            if (car) {
                const spawnZ = playerZ + 600 + Math.random() * 300;
                const roadX = getRoadX(spawnZ);
                car.spawn(spawnZ, roadX - 5, 20 + Math.random() * 15);
                this.activeCars.push(car);
                this.lastSpawnZ = playerZ;
            }
        }

        // 2. Movement & Dynamics
        for (let i = this.activeCars.length - 1; i >= 0; i--) {
            const car = this.activeCars[i];
            car.currentZ -= car.speed * delta;
            
            const roadX = getRoadX(car.currentZ);
            car.mesh.position.set(roadX - 5, 0, car.currentZ);
            
            car.update(playerZ);

            // Whoosh Trigger Logic could go here for sound

            if (car.currentZ < playerZ - 50) {
                car.deactivate();
                this.activeCars.splice(i, 1);
            }
        }
    }
}
