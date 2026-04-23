import * as THREE from 'three';

export class LightingManager {
  private scene: THREE.Scene;
  private headlights: THREE.Group;
  private ambientLight: THREE.HemisphereLight;
  private target: THREE.Object3D;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ambientLight = new THREE.HemisphereLight(0x2A3040, 0x0A0A0F, 0.6);
    this.scene.add(this.ambientLight);

    this.headlights = new THREE.Group();
    this.target = new THREE.Object3D();
    this.scene.add(this.headlights, this.target);
    this.setupHeadlights();
  }

  public async loadHDR(_url: string): Promise<void> {
    // HDR Loader can be added here if needed for environment reflections
  }

  private setupHeadlights(): void {
    const intensity = 400;
    const distance = 300;
    const angle = Math.PI / 5;

    const leftLight = new THREE.SpotLight(0xF4B942, intensity, distance, angle, 0.4, 1);
    leftLight.position.set(-0.8, 0.5, 0);
    leftLight.target = this.target;

    const rightLight = new THREE.SpotLight(0xF4B942, intensity, distance, angle, 0.4, 1);
    rightLight.position.set(0.8, 0.5, 0);
    rightLight.target = this.target;

    this.headlights.add(leftLight, rightLight);
  }

  public update(pos: THREE.Vector3, rot: number): void {
    this.headlights.position.copy(pos);
    this.headlights.rotation.y = rot;
    this.target.position.set(
      pos.x + Math.sin(rot) * 20,
      pos.y,
      pos.z + Math.cos(rot) * 20
    );
  }
}
