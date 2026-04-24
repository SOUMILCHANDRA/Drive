import * as THREE from 'three';

/**
 * LightingManager: Orchestrates the cold, cinematic night atmosphere of Nightcall.
 */
export class LightingManager {
  private scene: THREE.Scene;
  private ambient: THREE.AmbientLight;
  private hemisphere: THREE.HemisphereLight;
  private moon: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Silhouette Ambient (Cold Blue-Purple)
    this.ambient = new THREE.AmbientLight(0x1A1A2E, 0.08);
    this.scene.add(this.ambient);

    // 2. Sky/Ground Balance
    this.hemisphere = new THREE.HemisphereLight(0x0D0D1A, 0x0A0A0F, 0.15);
    this.scene.add(this.hemisphere);

    // 3. Directional Moon Light (Cold Blue-White)
    this.moon = new THREE.DirectionalLight(0xC8D4E8, 0.3);
    this.moon.position.set(50, 200, -100);
    this.moon.castShadow = true;
    
    // Optimize shadow map for subtle moonlight
    this.moon.shadow.mapSize.width = 1024;
    this.moon.shadow.mapSize.height = 1024;
    this.moon.shadow.camera.left = -500;
    this.moon.shadow.camera.right = 500;
    this.moon.shadow.camera.top = 500;
    this.moon.shadow.camera.bottom = -500;
    
    this.scene.add(this.moon);
  }

  public update(carPos: THREE.Vector3, _rot: number): void {
      // Keep the moon following the player at a distance for consistent shadows
      this.moon.position.x = carPos.x + 50;
      this.moon.position.z = carPos.z - 100;
      this.moon.target.position.copy(carPos);
      this.moon.target.updateMatrixWorld();
  }
}
