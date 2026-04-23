import * as THREE from 'three';
import { RGBELoader } from 'three-stdlib';

/**
 * LightingManager handles environmental lighting via HDR and car-specific lights.
 */
export class LightingManager {
  private scene: THREE.Scene;
  public headlights: THREE.Group;
  private leftHeadlight!: THREE.SpotLight;
  private rightHeadlight!: THREE.SpotLight;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.headlights = new THREE.Group();
    this.setupBasicLights();
    this.setupHeadlights();
  }

  private setupBasicLights(): void {
    // Soft ambient fill for base visibility
    const ambientLight = new THREE.AmbientLight(0x404040, 0.2);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x8888ff, 0x000000, 0.1);
    this.scene.add(hemiLight);
  }

  /**
   * Loads an HDR environment map for reflections.
   * Does NOT set it as the background to keep the scene focused on the road.
   */
  public async loadEnvironment(url: string): Promise<void> {
    const loader = new RGBELoader();
    try {
      const texture = await loader.loadAsync(url);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = texture;
      console.log('HDR Environment loaded successfully');
    } catch (error) {
      console.error('Failed to load HDR environment:', error);
    }
  }

  private setupHeadlights(): void {
    const intensity = 150;
    const distance = 150;
    const angle = Math.PI / 4;
    const penumbra = 0.3;

    this.leftHeadlight = this.createHeadlight(-1.0, intensity, distance, angle, penumbra);
    this.rightHeadlight = this.createHeadlight(1.0, intensity, distance, angle, penumbra);

    this.headlights.add(this.leftHeadlight);
    this.headlights.add(this.rightHeadlight);
    this.headlights.add(this.leftHeadlight.target);
    this.headlights.add(this.rightHeadlight.target);

    this.scene.add(this.headlights);
  }

  private createHeadlight(x: number, intensity: number, distance: number, angle: number, penumbra: number): THREE.SpotLight {
    const light = new THREE.SpotLight(0xfffaf0, intensity);
    light.position.set(x, 0.5, 0.5);
    light.distance = distance;
    light.angle = angle;
    light.penumbra = penumbra;
    light.decay = 2;
    
    light.castShadow = true;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.shadow.camera.near = 0.5;
    light.shadow.camera.far = 100;

    // Target slightly ahead
    light.target.position.set(x, 0, 10);
    
    return light;
  }

  public updateHeadlights(carPosition: THREE.Vector3, carRotationY: number): void {
    this.headlights.position.copy(carPosition);
    this.headlights.rotation.y = carRotationY;
  }
}
