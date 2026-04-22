import * as THREE from 'three';
import { CONFIG } from '../config';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

RectAreaLightUniformsLib.init();

/**
 * Represents the player vehicle with cinematic physics and camera logic.
 * Implements vintage suspension bobbing and stable spline-based grounding.
 */
export class Car {
  public mesh: THREE.Group;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public acceleration: number = CONFIG.CAR.ACCELERATION;
  public deceleration: number = 0.98;
  public maxSpeed: number = CONFIG.CAR.MAX_SPEED;
  public steeringAmount: number = CONFIG.CAR.STEERING;
  public angle: number = 0;

  private keys: Record<string, boolean> = {};
  private brakeLights: THREE.Mesh[] = [];
  private model: THREE.Group | null = null;
  private currentCameraPos: THREE.Vector3 = new THREE.Vector3(0, 10, -20);

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private normal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.mesh = new THREE.Group();
    this.setupInput();
    this.raycaster.far = 10;
  }

  /**
   * Initializes the procedural car model and attaches lights.
   */
  public async init() {
    await this.loadModel();
    this.attachLights();
    console.log("Drive: Grounded Car Initialized");
  }

  private async loadModel() {
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync('models/car/chevelle.glb');
        this.model = gltf.scene;
        
        // Muscle Car Calibration
        this.model.scale.set(0.02, 0.02, 0.02); // Typical scale for high-poly sketchfab models
        
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        this.model.position.set(-center.x, -box.min.y, -center.z); 
        
        this.mesh.add(this.model);
        this.model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    } catch (e) {
        console.warn("Model load failed, falling back to procedural box");
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.5 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4.5), mat);
        body.position.y = 0.25; // Flush bottom
        body.castShadow = true;
        this.mesh.add(body);
    }
  }

  private attachLights() {
    const headlightColor = 0xFFD700; // Drive 2011 Warm Amber
    const createHeadlight = (x: number) => {
      const spot = new THREE.SpotLight(headlightColor, 2000, 200, 0.6, 0.8, 1.0);
      spot.position.set(x, 0.6, 2.5);
      spot.castShadow = true;
      spot.shadow.mapSize.set(1024, 1024);

      const target = new THREE.Object3D();
      target.position.set(x, -0.5, 60);
      this.mesh.add(target);
      spot.target = target;
      this.mesh.add(spot);
    };
    createHeadlight(0.7);
    createHeadlight(-0.7);

    // Drive Tail Lights (Dim Red #8B0000)
    const tailColor = 0x8B0000;
    const createTailLight = (x: number) => {
        const light = new THREE.PointLight(tailColor, 10, 15, 2);
        light.position.set(x, 0.6, -2.5);
        this.mesh.add(light);
        
        const lens = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.2, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff0000, emissiveIntensity: 1 })
        );
        lens.position.set(x, 0.6, -2.5);
        this.mesh.add(lens);
        this.brakeLights.push(lens);
    };
    createTailLight(0.7);
    createTailLight(-0.7);
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
  }

  public get velocityValue(): number {
    return this.velocity.z;
  }

  /**
   * Main update loop for manual driving.
   * @param delta Frame delta time
   * @param getHeight Function to sample road height at current X, Z
   */
  public update(delta: number, getHeight: (x: number, z: number) => number) {
    const isBraking = this.keys['s'] || this.keys['arrowdown'];
    this.brakeLights.forEach(bl => (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = isBraking ? 5 : 1);

    if (this.keys['w'] || this.keys['arrowup']) this.velocity.z += this.acceleration * delta;
    else if (isBraking) this.velocity.z -= this.acceleration * delta;

    if (Math.abs(this.velocity.z) > 0.1) {
      if (this.keys['a'] || this.keys['arrowleft']) this.angle += this.steeringAmount * Math.sign(this.velocity.z);
      if (this.keys['d'] || this.keys['arrowright']) this.angle -= this.steeringAmount * Math.sign(this.velocity.z);
    }

    this.velocity.z *= this.deceleration;
    
    // Position Update
    this.mesh.position.x += Math.sin(this.angle) * this.velocity.z * delta;
    this.mesh.position.z += Math.cos(this.angle) * this.velocity.z * delta;

    // STABLE SPLINE ANCHOR: Height sampling + Precision Snap (-0.25 offset for flush contact)
    const roadHeight = Math.max(getHeight(this.mesh.position.x, this.mesh.position.z), 0);
    const time = Date.now() * 0.003;
    const bobbing = Math.sin(time) * 0.03;
    
    // Final Physics Lock: Snap directly to spline Y
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, roadHeight + bobbing, 0.2);
    
    // Keep rotation stable
    this.mesh.rotation.y = this.angle;
    
    // Reset normal for stability
    this.normal.set(0, 1, 0);
  }

  /**
   * Logic for autonomous spline following.
   */
  public autopilot(targetX: number, targetZ: number, targetAngle: number, targetY: number) {
    this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, targetX, 0.1);
    this.mesh.position.z = targetZ;
    this.angle = THREE.MathUtils.lerp(this.angle, targetAngle, 0.1);
    this.velocity.z = 25;
    
    // Vertical stabilization
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, 0.2);
    this.mesh.rotation.y = this.angle;
  }

  /**
   * Calculates the camera's world position and look-at target based on vehicle state.
   * Implements a Spring-Arm damping system to absorb high-frequency road math jitter.
   * @returns { position: Vector3, lookTarget: Vector3 }
   */
  public getCameraTransform() {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.mesh.quaternion);
    
    // SPRING-ARM TARGET: 3m behind, 2m above
    const idealPos = this.mesh.position.clone()
        .add(forward.clone().multiplyScalar(-3))
        .add(up.clone().multiplyScalar(2));

    // Axis-independent Damping
    this.currentCameraPos.lerp(idealPos, 0.1);

    const lookTarget = this.mesh.position.clone()
        .add(forward.clone().multiplyScalar(15))
        .add(up.clone().multiplyScalar(1.0));
    
    return { position: this.currentCameraPos.clone(), lookTarget };
  }
}
