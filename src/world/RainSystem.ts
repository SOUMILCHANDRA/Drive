import * as THREE from 'three';

/**
 * RainSystem: 15,000 streak particles with speed-driven lean and neon color picking.
 */
export class RainSystem {
    private scene: THREE.Scene;
    private particles!: THREE.Points;
    private geometry!: THREE.BufferGeometry;
    private material!: THREE.ShaderMaterial;
    private count: number = 15000;
    private boxSize: number = 200;

    constructor(scene: THREE.Scene, initialCount: number) {
        this.scene = scene;
        this.count = initialCount;
        this.init(this.count);
    }

    private init(count: number): void {
        if (this.particles) this.scene.remove(this.particles);
        if (count === 0) return;

        this.geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);
        const velocities = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * this.boxSize;
            positions[i * 3 + 1] = Math.random() * this.boxSize;
            positions[i * 3 + 2] = (Math.random() - 0.5) * this.boxSize;
            velocities[i] = 100 + Math.random() * 50;
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 1));

        if (!this.material) {
            this.material = new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uSpeed: { value: 0 },
                    uCarPos: { value: new THREE.Vector3() },
                    uNeonColor: { value: new THREE.Color(0xffffff) },
                    uNeonPos: { value: new THREE.Vector3(0, 0, 0) }
                },
                transparent: true,
                depthWrite: false,
                vertexShader: `
                    uniform float uTime;
                    uniform float uSpeed;
                    uniform vec3 uCarPos;
                    attribute float velocity;
                    varying float vOpacity;
                    
                    void main() {
                        vec3 pos = position;
                        pos.y = mod(pos.y - uTime * velocity, 200.0);
                        float lean = (uSpeed / 40.0) * 15.0;
                        pos.z += lean;
                        vec4 mvPosition = modelViewMatrix * vec4(pos + uCarPos - vec3(0, 100, 0), 1.0);
                        gl_Position = projectionMatrix * mvPosition;
                        gl_PointSize = 2.0;
                        vOpacity = 0.15;
                    }
                `,
                fragmentShader: `
                    varying float vOpacity;
                    void main() {
                        gl_FragColor = vec4(1.0, 1.0, 1.0, vOpacity);
                    }
                `
            });
        }

        this.particles = new THREE.Points(this.geometry, this.material);
        this.particles.frustumCulled = false;
        this.scene.add(this.particles);
    }

    public updateQuality(count: number): void {
        this.count = count;
        this.init(count);
    }

    public update(delta: number, carPos: THREE.Vector3, speed: number): void {
        this.material.uniforms.uTime.value += delta;
        this.material.uniforms.uSpeed.value = speed;
        this.material.uniforms.uCarPos.value.copy(carPos);
    }
}
