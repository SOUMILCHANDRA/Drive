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
    public carLight?: THREE.PointLight;

    public baseAmbientIntensity: number = 0.22;
    public baseMoonIntensity: number = 0.35;
    public baseHemiIntensity: number = 0.25;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Ambient — subtle dark indigo fill so shadowed areas aren't crushed to #000
        this.ambient = new THREE.AmbientLight(0x181832, this.baseAmbientIntensity);
        this.scene.add(this.ambient);

        // 2. Hemisphere — sky: dark indigo #1a1a4e, ground: warm dark #0a0510
        this.hemisphere = new THREE.HemisphereLight(0x1a1a4e, 0x0a0510, this.baseHemiIntensity);
        this.scene.add(this.hemisphere);

        // 3. Directional "moon" — subtle cool indigo moonlight (rim/accent, not a stadium floodlight)
        this.moon = new THREE.DirectionalLight(0x829ad4, this.baseMoonIntensity);
        this.moon.position.set(-80, 160, -200);
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
    }

    /** Underseat warm cabin fill light - soft interior glow without washing out the ground */
    public setupCarLight(carGroup: THREE.Group): void {
        this.carLight = new THREE.PointLight(0xff9530, 0.4, 2.5, 2);
        this.carLight.position.set(0, 0.8, -0.2);
        carGroup.add(this.carLight);
    }

    public update(carPos: THREE.Vector3, ambientMultiplier: number = 1): void {
        this.moon.position.x = carPos.x - 80;
        this.moon.position.z = carPos.z - 200;
        this.moon.target.position.copy(carPos);
        this.moon.target.updateMatrixWorld();

        // Keep ambient stable and readable
        const mult = Math.max(0.6, ambientMultiplier);
        this.ambient.intensity = this.baseAmbientIntensity * mult;
    }
}
