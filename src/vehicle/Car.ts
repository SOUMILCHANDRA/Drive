import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

/**
 * Car: The player's vehicle with robust loading, failsafe geometry, and kinetic physics.
 */
export class Car {
  public model: THREE.Group | null = null;
  private scene: THREE.Scene;
  
  // Kinetic State
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public heading: number = 0; 
  public speed: number = 0;
  private raycaster = new THREE.Raycaster();

  // Cinematic Lighting
  private headlights: THREE.SpotLight[] = [];
  private taillights: THREE.PointLight[] = [];

  // Tuning Constants (1973 Malibu Preset)
  private readonly ACCEL = 12;
  private readonly MAX_SPEED = 45;
  private readonly DRAG = 0.65;
  private readonly BRAKE_POWER = 20;
  private readonly MAX_TURN_RATE = 1.3;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Loads the vehicle GLB with robust error handling and material calibration.
   */
  public async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    
    try {
        const gltf = await loader.loadAsync(url);
        this.model = gltf.scene;
        
        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            if (child.material) {
              const mat = child.material as THREE.MeshStandardMaterial;
              if (mat.color) {
                  const r = mat.color.r;
                  const g = mat.color.g;
                  const b = mat.color.b;
                  mat.color.setRGB(Math.max(0.12, r), Math.max(0.12, g), Math.max(0.12, b));
              }
              mat.roughness = Math.min(mat.roughness ?? 0.5, 0.85);
              mat.metalness = Math.max(mat.metalness ?? 0.3, 0.5);
              mat.needsUpdate = true;
            }
          }
        });

        const box = new THREE.Box3().setFromObject(this.model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 4.5 / size.z;
        this.model.scale.setScalar(scale);
        
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        this.model.position.y = -center.y + (size.y * scale) / 2;

    } catch (error) {
        console.error('GLB failed to load:', error);
        this.createFallbackModel();
    }

    if (this.model) {
        this.scene.add(this.model);
        this.setupLights();
    }
  }

  private createFallbackModel(): void {
      this.model = new THREE.Group();
      const bodyGeo = new THREE.BoxGeometry(2, 1.2, 4.5);
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x1a1a1f, metalness: 0.8, roughness: 0.2 
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.6;
      body.castShadow = true;
      body.receiveShadow = true;
      this.model.add(body);
  }

  private setupLights(): void {
    const hlConfig = { color: 0xfff8e7, intensity: 8, distance: 120, angle: 0.4, penumbra: 0.5, decay: 1.5 };
    
    // LEFT headlight
    const headlightL = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra, hlConfig.decay);
    headlightL.position.set(-0.7, 0.6, 2.2);
    const targetL = new THREE.Object3D();
    targetL.position.set(-2, -1, 20); 
    this.model!.add(targetL);
    headlightL.target = targetL;
    headlightL.castShadow = false; 
    this.model!.add(headlightL);
    this.headlights.push(headlightL);

    // RIGHT headlight
    const headlightR = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra, hlConfig.decay);
    headlightR.position.set(0.7, 0.6, 2.2);
    const targetR = new THREE.Object3D();
    targetR.position.set(2, -1, 20);
    this.model!.add(targetR);
    headlightR.target = targetR;
    headlightR.castShadow = false;
    this.model!.add(headlightR);
    this.headlights.push(headlightR);

    [0.8, -0.8].forEach(x => {
        const light = new THREE.PointLight(0xCC1A1A, 1.2, 15);
        light.position.set(x, 0.5, -2.5);
        this.model!.add(light);
        this.taillights.push(light);
    });
  }

  public update(delta: number, input: { steer: number, throttle: number, brake: number }, roadX: number, roadMeshes: THREE.Object3D[]): void {
    if (!this.model) return;

    // 1. Kinetic Physics
    this.speed += input.throttle * this.ACCEL * delta;
    this.speed -= input.brake * this.BRAKE_POWER * delta;
    this.speed *= (1 - this.DRAG * delta);
    this.speed = Math.max(0, Math.min(this.speed, this.MAX_SPEED));

    // 2. Steering Velocity Scaling
    const speedFactor = Math.min(1.0, this.speed / (this.MAX_SPEED * 0.4));
    const turnRate = input.steer * this.MAX_TURN_RATE * speedFactor;
    this.heading += turnRate * delta;

    // 3. Magnetic Road Nudge
    const lateralDist = this.model.position.x - roadX;
    if (Math.abs(lateralDist) > 7) { 
        this.model.position.x = THREE.MathUtils.lerp(this.model.position.x, roadX + (Math.sign(lateralDist) * 7), 0.1);
    }

    // 4. Transform Updates
    this.position.x += Math.sin(this.heading) * this.speed * delta;
    this.position.z += Math.cos(this.heading) * this.speed * delta;
    
    // 5. Physical Road Alignment (Raycasting)
    this.raycaster.set(
        new THREE.Vector3(this.position.x, this.position.y + 5, this.position.z),
        new THREE.Vector3(0, -1, 0)
    );
    const hits = this.raycaster.intersectObjects(roadMeshes, true);
    if (hits.length > 0) {
        this.position.y = hits[0].point.y + 0.4;
    }

    this.model.position.copy(this.position);
    this.model.rotation.y = this.heading;

    // Visual Dynamic Lean
    this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, -input.steer * 0.08, 0.1);

    // Update Lighting
    this.taillights.forEach(light => {
        light.intensity = THREE.MathUtils.lerp(light.intensity, input.brake > 0.1 ? 6.0 : 1.2, 0.2);
    });
  }
}
