import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

/**
 * Car: The player's vehicle with custom Kinetic Physics and dynamic response.
 */
export class Car {
  public model: THREE.Group | null = null;
  private scene: THREE.Scene;
  
  // Kinetic State
  public position: THREE.Vector3 = new THREE.Vector3();
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public heading: number = 0; // Y rotation
  public speed: number = 0;
  public rotationY: number = 0;

  // Cinematic Lighting
  private headlights: THREE.SpotLight[] = [];
  private taillights: THREE.PointLight[] = [];
  private headlightTarget: THREE.Object3D;

  // Tuning Constants
  private readonly ACCEL = 10;
  private readonly MAX_SPEED = 40;
  private readonly DRAG = 0.6;
  private readonly BRAKE_POWER = 18;
  private readonly MAX_TURN_RATE = 1.2;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.headlightTarget = new THREE.Object3D();
    this.scene.add(this.headlightTarget);
  }

  public async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync(url);
        this.model = gltf.scene;
        this.applyMaterials(this.model);
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        this.model.position.sub(center);
        this.model.scale.setScalar(5 / size.x);
        this.model.position.y = (size.y * (5 / size.x)) / 2;
    } catch (e) {
        this.createFallbackModel();
    }
    if (this.model) {
        this.scene.add(this.model);
        this.setupLights();
    }
  }

  private createFallbackModel(): void {
      this.model = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: 0xCC1A1A, metalness: 0.8 }));
      body.position.y = 0.5;
      this.model.add(body);
  }

  private setupLights(): void {
    const hlConfig = { color: 0xFFF8E7, intensity: 300, distance: 150, angle: 0.35, penumbra: 0.4 };
    [0.8, -0.8].forEach(x => {
        const light = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra);
        light.position.set(x, 0.5, 2.5);
        light.target = this.headlightTarget;
        light.castShadow = true;
        this.model!.add(light);
        this.headlights.push(light);
    });
    [0.8, -0.8].forEach(x => {
        const light = new THREE.PointLight(0xCC1A1A, 0.8, 12);
        light.position.set(x, 0.5, -2.5);
        this.model!.add(light);
        this.taillights.push(light);
    });
  }

  public update(delta: number, input: { steer: number, throttle: number, brake: number }, roadX: number): void {
    if (!this.model) return;

    // 1. Kinetic Physics
    this.speed += input.throttle * this.ACCEL * delta;
    this.speed -= input.brake * this.BRAKE_POWER * delta;
    this.speed *= (1 - this.DRAG * delta);
    this.speed = Math.max(0, Math.min(this.speed, this.MAX_SPEED));

    // 2. Velocity-Scaled Steering
    const speedFactor = Math.min(1.0, this.speed / (this.MAX_SPEED * 0.3)); // Stable at low speeds too
    const turnRate = input.steer * this.MAX_TURN_RATE * speedFactor;
    this.heading += turnRate * delta;

    // 3. Magnetic Road Nudge (Soft Pull)
    const lateralDist = this.model.position.x - roadX;
    if (Math.abs(lateralDist) > 7) { // Beyond road edge
        this.model.position.x = THREE.MathUtils.lerp(this.model.position.x, roadX + (Math.sign(lateralDist) * 7), 0.1);
    }

    // 4. Update Transforms
    this.velocity.set(
        Math.sin(this.heading) * this.speed,
        0,
        Math.cos(this.heading) * this.speed
    );
    this.model.position.add(this.velocity.clone().multiplyScalar(delta));
    this.model.rotation.y = this.heading;
    this.rotationY = this.heading;

    // Visual Lean
    this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, -input.steer * 0.05, 0.1);

    // Update Lighting
    this.headlightTarget.position.set(
        this.model.position.x + Math.sin(this.heading) * 20,
        0.5,
        this.model.position.z + Math.cos(this.heading) * 20
    );
    this.taillights.forEach(light => {
        light.intensity = THREE.MathUtils.lerp(light.intensity, input.brake > 0.1 ? 4.0 : 0.8, 0.2);
    });
  }

  private applyMaterials(model: THREE.Group): void {
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x1A1A1F,
        metalness: 0.9,
        roughness: 0.15,
        name: 'MalibuBody'
    });

    const windowMat = new THREE.MeshPhysicalMaterial({
        color: 0x050510,
        metalness: 0.5,
        roughness: 0.05,
        transmission: 0.3,
        transparent: true,
        name: 'MalibuGlass'
    });

    const chromeMat = new THREE.MeshStandardMaterial({
        color: 0xC0C0C0,
        metalness: 1.0,
        roughness: 0.05,
        name: 'MalibuChrome'
    });

    const tireMat = new THREE.MeshStandardMaterial({
        color: 0x0A0A0A,
        roughness: 0.9,
        name: 'MalibuTire'
    });

    const radioGlow = new THREE.MeshBasicMaterial({
        color: 0xFF2D78,
        name: 'RadioDial'
    });

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const name = child.name.toLowerCase();
        if (name.includes('body') || name.includes('paint')) child.material = bodyMat;
        else if (name.includes('window') || name.includes('glass')) child.material = windowMat;
        else if (name.includes('chrome') || name.includes('trim') || name.includes('bumper')) child.material = chromeMat;
        else if (name.includes('tire') || name.includes('wheel')) child.material = tireMat;
        else if (name.includes('radio') || name.includes('dash')) child.material = radioGlow;
        
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }
}
