import * as THREE from 'three';

/**
 * LightingManager: Balanced cinematic lighting for Nightcall.
 * Ensures readable world geometry using dark indigo hemisphere sky
 * and dim moonlight so nothing is pure pitch black.
 */
export class LightingManager {
    public scene: THREE.Scene;
    public ambient: THREE.AmbientLight;
    public hemisphere: THREE.HemisphereLight;
    public moon: THREE.DirectionalLight;
    public rimLight: THREE.DirectionalLight;
    public carLight?: THREE.PointLight;

    public baseAmbientIntensity: number = 0.22;
    public baseMoonIntensity: number = 0.70;
    public baseHemiIntensity: number = 0.60;
    public baseRimIntensity: number = 0.40;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Ambient — subtle dark indigo fill so shadowed areas aren't crushed to #000
        this.ambient = new THREE.AmbientLight(0x181832, this.baseAmbientIntensity);
        this.scene.add(this.ambient);

        // 2. Hemisphere (Bug 3b) — sky #2a3a7a / ground #120a1a, intensity 0.6
        this.hemisphere = new THREE.HemisphereLight(0x2a3a7a, 0x120a1a, this.baseHemiIntensity);
        this.scene.add(this.hemisphere);

        // 3. Moon DirectionalLight (Bug 3b) — #6f86ff, intensity 0.7, casting shadows from above/side
        this.moon = new THREE.DirectionalLight(0x6f86ff, this.baseMoonIntensity);
        this.moon.position.set(-60, 140, -120);
        this.moon.castShadow = true;

        this.moon.shadow.mapSize.width = 1024;
        this.moon.shadow.mapSize.height = 1024;
        this.moon.shadow.camera.near = 10;
        this.moon.shadow.camera.far = 300;
        
        this.moon.shadow.camera.left = -45;
        this.moon.shadow.camera.right = 45;
        this.moon.shadow.camera.top = 45;
        this.moon.shadow.camera.bottom = -45;
        this.moon.shadow.bias = -0.0005;

        this.scene.add(this.moon);

        // 4. Subtle rim light behind camera (Bug 3b) — DirectionalLight #ff3a9a, intensity 0.4
        this.rimLight = new THREE.DirectionalLight(0xff3a9a, this.baseRimIntensity);
        this.rimLight.position.set(0, 18, -45);
        this.rimLight.castShadow = false;
        this.scene.add(this.rimLight);
    }

    /** Underseat warm cabin fill light - soft interior glow without washing out the ground */
    public setupCarLight(carGroup: THREE.Group): void {
        this.carLight = new THREE.PointLight(0xff9530, 0.4, 2.5, 2);
        this.carLight.position.set(0, 0.8, -0.2);
        carGroup.add(this.carLight);
    }

    public update(carPos: THREE.Vector3, ambientMultiplier: number = 1): void {
        // Moon tracks overhead with side angle
        this.moon.position.x = carPos.x - 60;
        this.moon.position.z = carPos.z - 120;
        this.moon.target.position.copy(carPos);
        this.moon.target.updateMatrixWorld();

        // Rim light stays behind chase camera aiming forward along highway
        this.rimLight.position.set(carPos.x, carPos.y + 18, carPos.z - 45);
        this.rimLight.target.position.set(carPos.x, carPos.y + 2, carPos.z + 50);
        this.rimLight.target.updateMatrixWorld();

        // Keep ambient stable and readable
        const mult = Math.max(0.6, ambientMultiplier);
        this.ambient.intensity = this.baseAmbientIntensity * mult;
    }
}
