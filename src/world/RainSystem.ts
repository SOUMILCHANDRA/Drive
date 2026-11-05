import * as THREE from 'three';

/**
 * RainSystem: Single THREE.Points holding 12,000 atmospheric particles
 * with velocity-aware aerodynamic leaning and localized spatial recycling.
 */
export class RainSystem {
    private scene: THREE.Scene;
    private particles: THREE.Points;
    private geometry: THREE.BufferGeometry;
    private velocities: Float32Array;
    private maxCount: number = 8000;
    private activeCount: number = 8000;
    private spread: number = 150;

    constructor(scene: THREE.Scene, initialCount: number = 8000) {
        this.scene = scene;
        this.activeCount = initialCount;

        const positions = new Float32Array(this.maxCount * 3);
        this.velocities = new Float32Array(this.maxCount);

        for (let i = 0; i < this.maxCount; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * this.spread;
            positions[i * 3 + 1] = Math.random() * 80;
            positions[i * 3 + 2] = (Math.random() - 0.5) * this.spread;
            this.velocities[i] = 25 + Math.random() * 18;
        }

        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0x90a8cc,
            size: 0.045,
            transparent: true,
            opacity: 0.25,
            sizeAttenuation: true,
            depthWrite: false
        });

        this.particles = new THREE.Points(this.geometry, material);
        this.particles.frustumCulled = false;
        this.scene.add(this.particles);
    }

    public setCount(count: number): void {
        this.activeCount = Math.max(0, Math.min(this.maxCount, count));
        this.particles.visible = this.activeCount > 0;
        this.geometry.setDrawRange(0, this.activeCount);
    }

    public update(delta: number, carPos: THREE.Vector3, carSpeed: number): void {
        if (this.activeCount <= 0 || !this.particles.visible) return;

        const pos = this.geometry.attributes.position.array as Float32Array;
        const count = this.activeCount;
        const halfSpread = this.spread * 0.5;
        // Speed-aware aerodynamic lean
        const speedLean = carSpeed * delta * 0.45;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            // 1. Vertical Gravity Fall
            pos[i3 + 1] -= this.velocities[i] * delta;
            
            // 2. Velocity-Aware Aerodynamic Slant
            pos[i3 + 2] -= speedLean;
            
            // 3. Vertical Recycling above player
            if (pos[i3 + 1] < carPos.y - 4.0) {
                pos[i3 + 1] = carPos.y + 70.0;
            }

            // 4. Horizontal Recycling around vehicle
            const dx = pos[i3 + 0] - carPos.x;
            const dz = pos[i3 + 2] - carPos.z;

            if (Math.abs(dx) > halfSpread) {
                pos[i3 + 0] = carPos.x - Math.sign(dx) * halfSpread;
            }
            if (Math.abs(dz) > halfSpread) {
                pos[i3 + 2] = carPos.z - Math.sign(dz) * halfSpread;
            }
        }
        
        this.geometry.attributes.position.needsUpdate = true;
    }

    public shiftOrigin(offsetZ: number): void {
        const pos = this.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < this.activeCount; i++) {
            pos[i * 3 + 2] -= offsetZ;
        }
        this.geometry.attributes.position.needsUpdate = true;
    }
}
