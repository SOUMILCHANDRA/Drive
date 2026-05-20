import * as THREE from 'three';

/**
 * LightingManager: Warm LA sodium-vapor night atmosphere.
 * References the nocturnal amber glow of Drive (2011).
 */
export class LightingManager {
    private scene: THREE.Scene;
    private ambient: THREE.AmbientLight;
    private hemisphere: THREE.HemisphereLight;
    private moon: THREE.DirectionalLight;
    private carLight?: THREE.PointLight;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Ambient — deep warm amber (sodium-vapor streetlight bleed)
        this.ambient = new THREE.AmbientLight(0x3d1f05, 1.2);
        this.scene.add(this.ambient);

        // 2. Hemisphere — warm amber sky, cool dark ground
        this.hemisphere = new THREE.HemisphereLight(0x2a1505, 0x050302, 0.9);
        this.scene.add(this.hemisphere);

        // 3. Directional "moon" — cool blue-silver, set low for long shadows
        this.moon = new THREE.DirectionalLight(0xb8c8e0, 2.5);
        this.moon.position.set(-200, 350, -100);
        this.moon.castShadow = true;

        this.moon.shadow.mapSize.width = 2048;
        this.moon.shadow.mapSize.height = 2048;
        this.moon.shadow.camera.near = 0.5;
        this.moon.shadow.camera.far = 1000;
        this.moon.shadow.camera.left = -250;
        this.moon.shadow.camera.right = 250;
        this.moon.shadow.camera.top = 250;
        this.moon.shadow.camera.bottom = -250;

        this.scene.add(this.moon);
    }

    /** Underseat fill light — warms the car in the sodium glow. */
    public setupCarLight(carGroup: THREE.Group): void {
        this.carLight = new THREE.PointLight(0xff8c20, 1.8, 35);
        this.carLight.position.set(0, 8, 0);
        carGroup.add(this.carLight);
    }

    public update(carPos: THREE.Vector3, _ambientIntensity: number = 1): void {
        // Moon follows player for consistent lighting at any distance
        this.moon.position.x = carPos.x - 200;
        this.moon.position.z = carPos.z - 100;
        this.moon.target.position.copy(carPos);
        this.moon.target.updateMatrixWorld();

        // Dynamic ambient based on biome density
        this.ambient.intensity = 0.3 * _ambientIntensity;
    }
}
