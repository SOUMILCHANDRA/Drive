import * as THREE from 'three';

/**
 * LightingManager: Manages global ambient atmosphere for the Nightcall city.
 */
export class LightingManager {
  private scene: THREE.Scene;
  private ambientLight: THREE.HemisphereLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // Cold, nocturnal ambient light (#2A3040 for sky, #0A0A0F for ground)
    this.ambientLight = new THREE.HemisphereLight(0x2A3040, 0x0A0A0F, 0.6);
    this.scene.add(this.ambientLight);
  }

  public update(_pos: THREE.Vector3, _rot: number): void {
      // Global ambient updates can be added here
  }
}
