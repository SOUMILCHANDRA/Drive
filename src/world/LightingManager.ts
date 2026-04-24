import * as THREE from 'three';

/**
 * LightingManager: Orchestrates the cold, cinematic night atmosphere of Nightcall.
 */
export class LightingManager {
  private scene: THREE.Scene;
  private ambient: THREE.AmbientLight;
  private hemisphere: THREE.HemisphereLight;
  private moon: THREE.DirectionalLight;
  private carLight?: THREE.PointLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Ambient — raise from 0.08 to 0.25 so you can see the road
    this.ambient = new THREE.AmbientLight(0x1a2040, 0.25);
    this.scene.add(this.ambient);

    // 2. Hemisphere — keep sky dark, make ground slightly visible
    this.hemisphere = new THREE.HemisphereLight(0x0d1020, 0x080808, 0.3);
    this.scene.add(this.hemisphere);

    // 3. Directional "moon" light — crucial for road surface to be visible
    this.moon = new THREE.DirectionalLight(0xc8d4e8, 0.5);
    this.moon.position.set(-200, 400, -100);
    this.moon.castShadow = true;
    
    // Optimized high-fidelity shadows
    this.moon.shadow.mapSize.width = 2048;
    this.moon.shadow.mapSize.height = 2048;
    this.moon.shadow.camera.near = 0.5;
    this.moon.shadow.camera.far = 800;
    this.moon.shadow.camera.left = -200;
    this.moon.shadow.camera.right = 200;
    this.moon.shadow.camera.top = 200;
    this.moon.shadow.camera.bottom = -200;
    
    this.scene.add(this.moon);
  }

  /**
   * Failsafe point light to always illuminate the car.
   */
  public setupCarLight(carGroup: THREE.Group): void {
      this.carLight = new THREE.PointLight(0xfff0dd, 1.5, 30);
      this.carLight.position.set(0, 8, 0); 
      carGroup.add(this.carLight);
  }

  public update(carPos: THREE.Vector3, _ambientIntensity: number = 1): void {
      // Keep the moon following the player for consistent lighting
      this.moon.position.x = carPos.x - 200;
      this.moon.position.z = carPos.z - 100;
      this.moon.target.position.copy(carPos);
      this.moon.target.updateMatrixWorld();

      // Dynamic ambient adjustment based on biomes
      this.ambient.intensity = 0.25 * _ambientIntensity;
  }
}
