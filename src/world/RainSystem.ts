import * as THREE from 'three';

/**
 * RainSystem: 12,000 streak particles with speed-driven lean and localized recycling.
 */
export class RainSystem {
    private scene: THREE.Scene;
    private particles: THREE.Points;
    private geometry: THREE.BufferGeometry;
    private velocities: Float32Array;
    private count: number = 12000;
    private spread: number = 150;

    constructor(scene: THREE.Scene, initialCount: number = 12000) {
        this.scene = scene;
        this.count = initialCount;

        const positions = new Float32Array(this.count * 3);
        this.velocities = new Float32Array(this.count);

        for (let i = 0; i < this.count; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * this.spread;
            positions[i * 3 + 1] = Math.random() * 80;
            positions[i * 3 + 2] = (Math.random() - 0.5) * this.spread;
            this.velocities[i] = 20 + Math.random() * 15;
        }

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x99aacc,
            size: 0.1,
            transparent: true,
            opacity: 0.35,
            sizeAttenuation: true,
        });

        this.particles = new THREE.Points(this.geometry, material);
        this.particles.frustumCulled = false;
        this.scene.add(this.particles);
    }

    public updateQuality(_count: number): void {
        // Dynamic resizing could be added here later if needed
    }

    public update(delta: number, carPos: THREE.Vector3, carSpeed: number): void {
        const pos = this.geometry.attributes.position.array as Float32Array;
        
        for (let i = 0; i < this.count; i++) {
            // 1. Gravity Fall
            pos[i * 3 + 1] -= this.velocities[i] * delta;
            
            // 2. Speed Lean (Simulates air drag)
            pos[i * 3 + 2] -= carSpeed * delta * 0.4;
            
            // 3. Vertical Wrapping
            if (pos[i * 3 + 1] < carPos.y - 5) {
                pos[i * 3 + 1] = carPos.y + 75;
            }

            // 4. Horizontal Spacing (Keep centered on car with wrapping)
            const dx = pos[i * 3 + 0] - carPos.x;
            const dz = pos[i * 3 + 2] - carPos.z;

            if (Math.abs(dx) > this.spread / 2) {
                pos[i * 3 + 0] = carPos.x - Math.sign(dx) * (this.spread / 2);
            }
            if (Math.abs(dz) > this.spread / 2) {
                pos[i * 3 + 2] = carPos.z - Math.sign(dz) * (this.spread / 2);
            }
        }
        
        this.geometry.attributes.position.needsUpdate = true;
    }
}
