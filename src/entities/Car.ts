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
        
        // AUTO-SCALE TO 4.5m LENGTH
        const box = new THREE.Box3().setFromObject(this.model);
        const size = box.getSize(new THREE.Vector3());
        const scaleFactor = 4.5 / size.z;
        this.model.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // RE-CALIBRATE PIVOT
        const scaledBox = new THREE.Box3().setFromObject(this.model);
        const center = scaledBox.getCenter(new THREE.Vector3());
        this.model.position.set(-center.x, -scaledBox.min.y, -center.z); 
        
        this.mesh.add(this.model);
        
        // MATERIAL RESTORATION: High-Gloss Neon-Noir Paint
        this.model.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry.computeVertexNormals(); 
                child.material = new THREE.MeshStandardMaterial({
                    color: child.material.color || 0x050505,
                    roughness: 0.2, // High-gloss finish
                    metalness: 0.7  // Reflective catch for Sodium/Neon
                });
                child.castShadow = true;
                child.receiveShadow = true;
                child.frustumCulled = true;
            }
        });
    } catch (e) {
        console.warn("Model load failed, falling back to procedural box");
        const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.5 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4.5), mat);
        body.position.y = 0.25; 
        body.castShadow = true;
        this.mesh.add(body);
    }
  }

  private attachLights() {
    const headlightColor = 0xFFD700; 
    const createHeadlight = (x: number) => {
      // FINAL LOCK: Soft Amber Halogen Pools
      const spot = new THREE.SpotLight(headlightColor, 2000, 100, 0.6, 0.8, 1.0);
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

    // GROUNDING SHADOW: Final Lock Physical Anchor
    const shadowGeo = new THREE.CircleGeometry(1.5, 32);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.7 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.05; // Slightly above road to avoid z-fight
    this.mesh.add(shadow);

    // THE "RED RIM" BEACONS - Decoupled to prevent internal bleed
    const tailColor = 0xFF0000;
    const createTailLight = (x: number) => {
        const light = new THREE.PointLight(tailColor, 40, 20, 2); 
        light.position.set(x, 0.6, -2.8); // Shifted behind bumper
        this.mesh.add(light);
        
        const lens = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.2, 0.1),
            new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 3 })
        );
        lens.position.set(x, 0.6, -2.6);
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
    this.brakeLights.forEach(bl => (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = isBraking ? 10 : 3);

    if (this.keys['w'] || this.keys['arrowup']) this.velocity.z += this.acceleration * delta;
    else if (isBraking) this.velocity.z -= this.acceleration * delta;

    if (Math.abs(this.velocity.z) > 0.1) {
      if (this.keys['a'] || this.keys['arrowleft']) this.angle += this.steeringAmount * Math.sign(this.velocity.z);
      if (this.keys['d'] || this.keys['arrowright']) this.angle -= this.steeringAmount * Math.sign(this.velocity.z);
    }

    this.velocity.z *= this.deceleration;
    
    // POSITION UPDATE
    this.mesh.position.x += Math.sin(this.angle) * this.velocity.z * delta;
    this.mesh.position.z += Math.cos(this.angle) * this.velocity.z * delta;

    // EMERGENCY GROUNDING SNAP: Hard-lock Y to road surface
    const roadHeight = Math.max(getHeight(this.mesh.position.x, this.mesh.position.z), 0);
    const time = Date.now() * 0.003;
    const bobbing = Math.sin(time) * 0.02; 
    
    // TOTAL PIVOT: 'Zen' Physics Glide (Smooth Suspension)
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, roadHeight + 0.1 + bobbing, 0.05);
    
    // KINETIC STEERING: Heavy weight damping (0.03)
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.angle, 0.03);
    
    // Reset normal for stability
    this.normal.set(0, 1, 0);
  }

  /**
   * Logic for autonomous spline following.
   */
  public autopilot(targetX: number, targetZ: number, targetAngle: number, targetY: number) {
    this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, targetX, 0.1);
    this.mesh.position.z = targetZ;
    this.angle = targetAngle;
    this.velocity.z = 25;
    
    // Vertical stabilization (-0.25 pivot correction)
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY - 0.25, 0.2);
    
    // KINETIC STEERING: Heavy weight damping (0.03)
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, this.angle, 0.03);
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

    // Axis-independent Damping (Zen Damping: 0.05)
    this.currentCameraPos.lerp(idealPos, 0.05);

    const lookTarget = this.mesh.position.clone()
        .add(forward.clone().multiplyScalar(15))
        .add(up.clone().multiplyScalar(1.0));
    
    return { position: this.currentCameraPos.clone(), lookTarget };
  }
}
