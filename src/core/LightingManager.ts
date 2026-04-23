import * as THREE from 'three';
import { RGBELoader } from 'three-stdlib';

/**
 * LightingManager: HDR Environment and SpotLight Headlights.
 */
export class LightingManager {
  private scene: THREE.Scene;
  public headlightGroup: THREE.Group;
  private leftLight!: THREE.SpotLight;
  private rightLight!: THREE.SpotLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.headlightGroup = new THREE.Group();
    this.setupEnvironmentalLights();
    this.setupHeadlights();
  }

  private setupEnvironmentalLights(): void {
    const ambient = new THREE.AmbientLight(0x4040ff, 0.05);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x000022, 0x000000, 0.1);
    this.scene.add(hemi);
  }

  public async loadHDR(url: string): Promise<void> {
    const loader = new RGBELoader();
    try {
      const texture = await loader.loadAsync(url);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = texture; // ONLY environment for reflections
    } catch (e) {
      console.error("HDR Load Error", e);
    }
  }

  private setupHeadlights(): void {
    const intensity = 120;
    const distance = 150;
    const angle = Math.PI / 5;

    this.leftLight = this.createSpotlight(-1, intensity, distance, angle);
    this.rightLight = this.createSpotlight(1, intensity, distance, angle);

    this.headlightGroup.add(this.leftLight, this.rightLight);
    this.headlightGroup.add(this.leftLight.target, this.rightLight.target);
    this.scene.add(this.headlightGroup);
  }

  private createSpotlight(x: number, intensity: number, distance: number, angle: number): THREE.SpotLight {
    const light = new THREE.SpotLight(0xffffff, intensity);
    light.position.set(x, 0.5, 0.5);
    light.distance = distance;
    light.angle = angle;
    light.penumbra = 0.5;
    light.decay = 2;
    light.castShadow = true;
    
    // Crucial: Headlight Target
    light.target.position.set(x, 0, 20);
    return light;
  }

  public update(carPos: THREE.Vector3, carRotY: number): void {
    this.headlightGroup.position.copy(carPos);
    this.headlightGroup.rotation.y = carRotY;
  }
}
