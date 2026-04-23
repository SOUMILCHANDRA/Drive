import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

export class Car {
  public model: THREE.Group | null = null;
  private scene: THREE.Scene;
  public rotationY: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    this.model = gltf.scene;

    this.model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = new THREE.MeshStandardMaterial({
          color: mesh.name.toLowerCase().includes('body') ? 0xCC1A1A : (mesh.material as THREE.MeshStandardMaterial).color,
          metalness: 1.0,
          roughness: 0.05, // Ultra-slick
          envMapIntensity: 2.5,
        });
        mesh.material = mat;
      }
    });

    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.model.position.sub(center);
    this.model.scale.setScalar(5 / size.x);
    this.model.position.y = (size.y * (5 / size.x)) / 2;

    this.scene.add(this.model);
  }

  public update(_delta: number, inputX: number): void {
    if (!this.model) return;
    this.rotationY = THREE.MathUtils.lerp(this.rotationY, -inputX * 0.15, 0.1);
    this.model.rotation.y = this.rotationY;
    this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, -inputX * 0.05, 0.1);
  }
}
