import * as THREE from 'three';

/**
 * TrafficVehicle: Oncoming vehicles with halogen headlights that flare into bloom.
 */
class TrafficVehicle {
    public mesh: THREE.Group;
    public active: boolean = false;
    public speed: number = 0;
    public currentZ: number = 0;
    public laneX: number = -4.5;
    public hasNearMissed: boolean = false;
    public hasCollided: boolean = false;

    private emissiveMaterials: THREE.MeshBasicMaterial[] = [];

    constructor() {
        this.mesh = new THREE.Group();
        
        // Chassis (dark silhouette)
        const bodyGeo = new THREE.BoxGeometry(2.0, 0.75, 4.4);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x0c0b0a,
            roughness: 0.7,
            metalness: 0.3
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.5;
        this.mesh.add(body);

        // Halogen Headlight pair
        const hlGeo = new THREE.PlaneGeometry(0.4, 0.22);
        const hlMat = new THREE.MeshBasicMaterial({
            color: 0xffeed0,
            toneMapped: false
        });
        this.emissiveMaterials.push(hlMat);

        const leftHL = new THREE.Mesh(hlGeo, hlMat);
        leftHL.position.set(-0.65, 0.55, -2.21);
        leftHL.rotation.y = Math.PI; // Face oncoming direction (-Z)
        
        const rightHL = new THREE.Mesh(hlGeo, hlMat);
        rightHL.position.set(0.65, 0.55, -2.21);
        rightHL.rotation.y = Math.PI;

        // Volumetric Headlight Beams for oncoming traffic
        const tBeamGeo = new THREE.CylinderGeometry(0.1, 2.4, 28, 12, 1, true);
        tBeamGeo.rotateX(Math.PI / 2);
        tBeamGeo.translate(0, 0, 14);
        const tBeamMat = new THREE.ShaderMaterial({
            uniforms: {
                uColor: { value: new THREE.Color(0xfff0d0) },
                uIntensity: { value: 0.22 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uIntensity;
                varying vec2 vUv;
                void main() {
                    float radial = sin(vUv.x * 3.14159265);
                    float longitudinal = pow(1.0 - vUv.y, 1.6);
                    gl_FragColor = vec4(uColor, radial * longitudinal * uIntensity);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        [-0.65, 0.65].forEach(x => {
            const beam = new THREE.Mesh(tBeamGeo, tBeamMat);
            beam.position.set(x, 0.55, -2.21);
            beam.rotation.y = Math.PI; // Face oncoming (-Z)
            this.mesh.add(beam);
        });

        this.mesh.add(leftHL, rightHL);

        // Subtle rear red markers
        const tailMat = new THREE.MeshBasicMaterial({ color: 0xdd1111, toneMapped: false });
        const leftTL = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), tailMat);
        leftTL.position.set(-0.7, 0.55, 2.21);
        const rightTL = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.15), tailMat);
        rightTL.position.set(0.7, 0.55, 2.21);
        this.mesh.add(leftTL, rightTL);
    }

    public spawn(z: number, x: number, y: number, speed: number): void {
        this.currentZ = z;
        this.laneX = x;
        this.speed = speed;
        this.active = true;
        this.hasNearMissed = false;
        this.hasCollided = false;
        this.mesh.visible = true;
        this.mesh.position.set(x, y, z);
    }

    public update(playerZ: number): void {
        if (!this.active) return;
        const dist = this.currentZ - playerZ;
        
        // Intensity flare when car approaches camera plane
        const flare = dist > 0 && dist < 50 ? 1.0 + (1.0 - dist / 50) * 1.5 : 1.0;
        this.emissiveMaterials.forEach(m => {
            m.color.setRGB(1.0 * flare, 0.93 * flare, 0.8 * flare);
        });
    }

    public deactivate(): void {
        this.active = false;
        this.mesh.visible = false;
    }
}

/**
 * TrafficManager: Manages oncoming traffic pool and near-miss / collision checks.
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

    public update(
        delta: number, 
        playerZ: number, 
        getRoadPos: (z: number) => { x: number; y: number }
    ): void {
        // 1. Spawning Logic (Oncoming)
        if (playerZ - this.lastSpawnZ > 240 && this.activeCars.length < this.maxCars) {
            const car = this.pool.find(c => !c.active);
            if (car) {
                const spawnZ = playerZ + 550 + Math.random() * 200;
                const roadData = getRoadPos(spawnZ);
                // Oncoming traffic drives in left lane (-3.5 to -4.5 from road center)
                const laneOffset = -3.8 + (Math.random() - 0.5) * 1.2;
                car.spawn(spawnZ, roadData.x + laneOffset, roadData.y, 22 + Math.random() * 12);
                this.activeCars.push(car);
                this.lastSpawnZ = playerZ;
            }
        }

        // 2. Movement & Recycling
        for (let i = this.activeCars.length - 1; i >= 0; i--) {
            const car = this.activeCars[i];
            car.currentZ -= car.speed * delta;
            
            const roadData = getRoadPos(car.currentZ);
            car.mesh.position.set(roadData.x + (car.laneX - roadData.x), roadData.y, car.currentZ);
            car.update(playerZ);

            if (car.currentZ < playerZ - 60) {
                car.deactivate();
                this.activeCars.splice(i, 1);
            }
        }
    }

    /**
     * Checks for collisions or thrilling near misses with the player.
     */
    public checkPlayerInteraction(playerPos: THREE.Vector3): { collided: boolean; nearMiss: boolean } {
        let collided = false;
        let nearMiss = false;

        for (let i = 0; i < this.activeCars.length; i++) {
            const car = this.activeCars[i];
            if (!car.active) continue;

            const dz = Math.abs(car.currentZ - playerPos.z);
            const dx = Math.abs(car.mesh.position.x - playerPos.x);

            // Collision box
            if (dz < 3.8 && dx < 2.0 && !car.hasCollided) {
                car.hasCollided = true;
                collided = true;
            } else if (dz < 4.5 && dx < 3.8 && !car.hasNearMissed && !car.hasCollided) {
                car.hasNearMissed = true;
                nearMiss = true;
            }
        }

        return { collided, nearMiss };
    }
}
