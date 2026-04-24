import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

/**
 * Car: The player's vehicle with cinematic lighting and physics response.
 */
export class Car {
  public model: THREE.Group | null = null;
  private scene: THREE.Scene;
  public rotationY: number = 0;

  // Cinematic Lighting
  private headlights: THREE.SpotLight[] = [];
  private taillights: THREE.PointLight[] = [];
  private headlightTarget: THREE.Object3D;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.headlightTarget = new THREE.Object3D();
    this.scene.add(this.headlightTarget);
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
          roughness: 0.05,
          envMapIntensity: 2.5,
        });
        mesh.material = mat;
      }
    });

    // Auto-scale and center
    const box = new THREE.Box3().setFromObject(this.model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    this.model.position.sub(center);
    this.model.scale.setScalar(5 / size.x);
    this.model.position.y = (size.y * (5 / size.x)) / 2;

    this.scene.add(this.model);
    this.setupLights();
  }

  private setupLights(): void {
    if (!this.model) return;

    // 1. Warm White Headlights (#FFF8E7)
    const hlConfig = { color: 0xFFF8E7, intensity: 300, distance: 150, angle: 0.35, penumbra: 0.4 };
    
    [0.8, -0.8].forEach(x => {
        const light = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra);
        light.position.set(x, 0.5, 2.5);
        light.target = this.headlightTarget;
        light.castShadow = true;
        light.shadow.bias = -0.0001;
        this.model!.add(light);
        this.headlights.push(light);
    });

    // 2. Deep Red Taillights (#CC1A1A)
    [0.8, -0.8].forEach(x => {
        const light = new THREE.PointLight(0xCC1A1A, 0.8, 12);
        light.position.set(x, 0.5, -2.5);
        this.model!.add(light);
        this.taillights.push(light);
    });
  }

  public update(_delta: number, inputX: number, isBraking: boolean): void {
    if (!this.model) return;

    // Handling Physics
    this.rotationY = THREE.MathUtils.lerp(this.rotationY, -inputX * 0.15, 0.1);
    this.model.rotation.y = this.rotationY;
    this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, -inputX * 0.05, 0.1);

    // Update Headlight Target (Project Forward)
    this.headlightTarget.position.set(
        this.model.position.x + Math.sin(this.model.rotation.y) * 20,
        0,
        this.model.position.z + Math.cos(this.model.rotation.y) * 20
    );

    // 3. Brake Response Logic
    this.taillights.forEach(light => {
        light.intensity = THREE.MathUtils.lerp(light.intensity, isBraking ? 4.0 : 0.8, 0.2);
    });
  }
}
