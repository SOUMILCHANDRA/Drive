import * as THREE from 'three';

/**
 * TrafficVehicle: A simple, performance-optimized silhouette car for oncoming traffic.
 */
class TrafficVehicle {
    public mesh: THREE.Group;
    public active: boolean = false;
    public speed: number = 0;
    public currentZ: number = 0;
    public laneX: number = -4; // Opposite lane

    constructor() {
        this.mesh = new THREE.Group();
        
        // Silhouette Body
        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2, 0.8, 4),
            new THREE.MeshBasicMaterial({ color: 0x020202 })
        );
        body.position.y = 0.4;
        this.mesh.add(body);

        // Headlight Billboards (Front)
        const hlMat = new THREE.SpriteMaterial({ 
            color: 0xffffff, 
            transparent: true, 
            opacity: 0.8,
            map: this.createGlowTexture()
        });
        [0.7, -0.7].forEach(x => {
            const sprite = new THREE.Sprite(hlMat);
            sprite.scale.set(1.5, 1.5, 1);
            sprite.position.set(x, 0.5, 2.1);
            this.mesh.add(sprite);
        });

        // Taillight Billboards (Rear)
        const tlMat = new THREE.SpriteMaterial({ 
            color: 0xCC1A1A, 
            transparent: true, 
            opacity: 0.6,
            map: this.createGlowTexture()
        });
        [0.7, -0.7].forEach(x => {
            const sprite = new THREE.Sprite(tlMat);
            sprite.scale.set(1, 1, 1);
            sprite.position.set(x, 0.5, -2.1);
            this.mesh.add(sprite);
        });
    }

    private createGlowTexture(): THREE.Texture {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'white');
        grad.addColorStop(0.3, 'white');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    public spawn(z: number, x: number, speed: number): void {
        this.currentZ = z;
        this.laneX = x;
        this.speed = speed;
        this.active = true;
        this.mesh.visible = true;
        this.mesh.position.set(x, 0, z);
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
    private maxCars: number = 6;
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
        // 1. Spawning Logic
        if (playerZ - this.lastSpawnZ > 150 && this.activeCars.length < this.maxCars) {
            const car = this.pool.find(c => !c.active);
            if (car) {
                const spawnZ = playerZ + 800 + Math.random() * 400;
                const roadX = getRoadX(spawnZ);
                car.spawn(spawnZ, roadX - 4, 25 + Math.random() * 10);
                this.activeCars.push(car);
                this.lastSpawnZ = playerZ;
            }
        }

        // 2. Movement & Recycling
        for (let i = this.activeCars.length - 1; i >= 0; i--) {
            const car = this.activeCars[i];
            car.currentZ -= car.speed * delta;
            
            // Align with road curve as it moves
            const roadX = getRoadX(car.currentZ);
            car.mesh.position.set(roadX - 4, 0, car.currentZ);

            if (car.currentZ < playerZ - 50) {
                car.deactivate();
                this.activeCars.splice(i, 1);
            }
        }
    }
}
