import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

/**
 * CarController manages the car model, its PBR materials, and steering logic.
 */
export class CarController {
  public model: THREE.Group | null = null;
  private scene: THREE.Scene;
  public rotationY: number = 0;
  private targetRotationY: number = 0;
  private lerpSpeed: number = 0.05;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Loads the GLTF car model and enforces PBR materials.
   */
  public async loadModel(url: string): Promise<void> {
    const loader = new GLTFLoader();
    try {
      const gltf = await loader.loadAsync(url);
      this.model = gltf.scene;
      
      // Robust Centering and Scaling
      const box = new THREE.Box3().setFromObject(this.model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Scale to a standard size (e.g., 4 units long)
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 4 / maxDim;
      this.model.scale.set(scale, scale, scale);

      // Lift car so bottom is at y=0
      this.model.position.y = -box.min.y * scale;
      this.model.position.z = 0;
      
      // Orientation (Rotate 180 deg to face forward)
      this.model.rotation.y = Math.PI; 
      
      this.scene.add(this.model);

      // Re-enforce PBR Materials
      this.model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mesh.material = new THREE.MeshStandardMaterial({
            color: mat.color,
            map: mat.map,
            metalness: 0.8,
            roughness: 0.2,
            envMapIntensity: 1.5
          });
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      console.log(`Car loaded. Size: ${size.x},${size.y},${size.z} | Applied Scale: ${scale}`);
    } catch (error) {
      console.error('Failed to load car model:', error);
    }
  }

  /**
   * Updates car steering based on input.
   */
  public update(_delta: number, inputX: number): void {
    if (!this.model) return;

    // Steering logic
    const steeringLimit = 0.4;
    this.targetRotationY = -inputX * steeringLimit;
    
    // Smooth lerp for rotation
    this.rotationY = THREE.MathUtils.lerp(this.rotationY, this.targetRotationY, this.lerpSpeed);
    this.model.rotation.y = Math.PI + this.rotationY; // Apply to base rotation

    // Slight lean effect
    this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, -inputX * 0.05, 0.1);
    
    // Lateral movement simulation
    this.model.position.x = THREE.MathUtils.lerp(this.model.position.x, inputX * 2, 0.05);
  }

  public getPosition(): THREE.Vector3 {
    return this.model ? this.model.position : new THREE.Vector3();
  }
}
