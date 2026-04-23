import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

/**
 * CarController: GLTF Loading and Material Enforcement.
 */
export class CarController {
  public model: THREE.Group | null = null;
  private scene: THREE.Scene;
  public rotationY: number = 0;
  private targetRotationY: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    this.model = gltf.scene;

    const box = new THREE.Box3().setFromObject(this.model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = 4.5 / size.z;
    this.model.scale.set(scale, scale, scale);
    this.model.position.y = -box.min.y * scale;

    // Enforce Standard Materials
    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        mesh.material = new THREE.MeshStandardMaterial({
          color: mat.color,
          map: mat.map,
          metalness: 1.0, 
          roughness: 0.2, 
          envMapIntensity: 2.5 
        });
        mesh.castShadow = true;
      }
    });

    this.model.rotation.y = 0; 
    this.scene.add(this.model);
  }

  public update(_delta: number, inputX: number): void {
    if (!this.model) return;
    this.targetRotationY = -inputX * 0.3;
    this.rotationY = THREE.MathUtils.lerp(this.rotationY, this.targetRotationY, 0.05);
    this.model.rotation.y = this.rotationY;
    this.model.position.x = THREE.MathUtils.lerp(this.model.position.x, inputX * 2.5, 0.05);
  }

  public getPosition(): THREE.Vector3 {
    return this.model ? this.model.position : new THREE.Vector3();
  }
}
