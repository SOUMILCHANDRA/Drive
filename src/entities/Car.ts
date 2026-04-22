import * as THREE from 'three';
import { CONFIG } from '../config';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

RectAreaLightUniformsLib.init();

export class Car {
  public mesh: THREE.Group;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public acceleration: number = CONFIG.CAR.ACCELERATION;
  public deceleration: number = 0.98;
  public maxSpeed: number = CONFIG.CAR.MAX_SPEED;
  public steeringAmount: number = CONFIG.CAR.STEERING;
  public angle: number = 0;

  private keys: Record<string, boolean> = {};

  public driftFactor: number = 1.0;
  public isDrifting: boolean = false;
  private lastTapA: number = 0;
  private lastTapD: number = 0;
  public barrelRollAngle: number = 0;
  private isRolling: boolean = false;
  private rollDirection: number = 0;

  public trailColor: THREE.Color = new THREE.Color(0xffffff);

  public isAntiGravity: boolean = false;
  private gravityDir: number = 1;

  private wheels: THREE.Object3D[] = [];

  // Brake light meshes so we can update emissive on braking
  private brakeLights: THREE.Mesh[] = [];

  constructor() {
    this.mesh = new THREE.Group();
    this.setupInput();
  }

  public async init() {
    try {
      const loader = new GLTFLoader();
      const dracoLoader = new DRACOLoader();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(dracoLoader);

      const gltf = await loader.loadAsync('/models/car/car.glb');
      const loadedModel = gltf.scene;

      // Auto-center and Scale based on Bounding Box
      const bbox = new THREE.Box3().setFromObject(loadedModel);
      const size = bbox.getSize(new THREE.Vector3());
      const center = bbox.getCenter(new THREE.Vector3());
      
      // Target length of 4.5 units for the car
      const scale = 4.5 / Math.max(size.x, size.y, size.z);
      loadedModel.scale.set(scale, scale, scale);
      
      // Pivot it so the center is at (0, 0, 0) and it sits on the ground
      loadedModel.position.sub(center.multiplyScalar(scale));
      loadedModel.position.y += (size.y * scale) / 2 + 0.1;

      loadedModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          if (m) {
            m.roughness = Math.max(m.roughness, 0.3);
            m.metalness = Math.min(m.metalness, 0.8);
          }
        }
        if (child.name.toLowerCase().includes('wheel') || child.name.toLowerCase().includes('tire')) {
          this.wheels.push(child);
        }
      });

      this.mesh.add(loadedModel);
      console.log("Drive: 1970 Chevelle SS 454 Centered and Loaded");
      this.attachLights();
    } catch (e) {
      console.warn("Drive: Model loading failed, falling back to procedural.", e);
      this.createProceduralModel();
    }
  }

  private createProceduralModel() {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.2
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.6, 4.2), bodyMaterial);
    body.castShadow = true;
    body.position.y = 0.5;
    this.mesh.add(body);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.1, 0.4), bodyMaterial);
    spoiler.position.set(0, 0.8, -1.8);
    this.mesh.add(spoiler);

    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.7, 1.8),
      new THREE.MeshPhysicalMaterial({
        color: 0x000000,
        metalness: 0,
        roughness: 0.05,
        transmission: 0.6,
        thickness: 0.5,
        reflectivity: 1.0
      })
    );
    cab.position.set(0, 1.1, -0.4);
    this.mesh.add(cab);

    this.attachLights();
  }

  private attachLights() {
    const headlightColor = 0xfff2d0; // Warm halogen — hardcoded, not from config

    const createHeadlight = (x: number) => {
      const container = new THREE.Group();
      container.position.set(x, 0.6, 2.1);

      // Primary beam — FIX: intensity 5, not 30+
      const spot = new THREE.SpotLight(headlightColor, 5);
      spot.angle = 0.28;
      spot.distance = 90;
      spot.penumbra = 0.5;
      spot.decay = 2;
      spot.castShadow = false; // off for perf — shadows from headlights are expensive

      // Target parented to car, aimed 60 units ahead and slightly down
      const target = new THREE.Object3D();
      target.position.set(x, -1, 60);
      this.mesh.add(target);
      spot.target = target;

      // Outer spread — fills in the sides of the road
      const outer = new THREE.SpotLight(headlightColor, 2);
      outer.angle = 0.4;
      outer.distance = 40;
      outer.penumbra = 0.9;
      outer.decay = 2;

      const outerTarget = new THREE.Object3D();
      outerTarget.position.set(x > 0 ? 15 : -15, -2, 35);
      this.mesh.add(outerTarget);
      outer.target = outerTarget;

      // Visible bulb mesh
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: headlightColor })
      );

      container.add(spot);
      container.add(outer);
      container.add(bulb);
      return container;
    };

    this.mesh.add(createHeadlight(0.7));
    this.mesh.add(createHeadlight(-0.7));

    // FIX: Underglow intensity 150 was blowing out the entire scene
    // Set to 1.5 — just enough to cast a faint blue glow on the road below
    const underglow = new THREE.RectAreaLight(0x001122, 1.5, 2, 0.5);
    underglow.position.set(0, -0.4, 0);
    underglow.rotation.x = -Math.PI / 2;
    this.mesh.add(underglow);

    // Brake lights
    const brakeMat = new THREE.MeshStandardMaterial({
      color: 0x330000,
      emissive: 0xff0000,
      emissiveIntensity: 1.5  // FIX: was 10, causing giant red glow
    });

    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.1), brakeMat);
    b1.position.set(0.7, 0.6, -2.1);
    this.mesh.add(b1);
    this.brakeLights.push(b1);

    const b2 = b1.clone();
    b2.position.x = -0.7;
    this.mesh.add(b2);
    this.brakeLights.push(b2);
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'a') {
        const now = Date.now();
        if (now - this.lastTapA < 300) this.startBarrelRoll(-1);
        this.lastTapA = now;
      }
      if (e.key.toLowerCase() === 'd') {
        const now = Date.now();
        if (now - this.lastTapD < 300) this.startBarrelRoll(1);
        this.lastTapD = now;
      }
    });
    window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
  }

  private startBarrelRoll(dir: number) {
    if (this.isRolling) return;
    this.isRolling = true;
    this.rollDirection = dir;
    this.barrelRollAngle = 0;
  }

  public update(delta: number, getHeight: (x: number, z: number) => number) {
    const isBraking = this.keys['s'] || this.keys['arrowdown'];

    // Update brake light intensity based on input
    this.brakeLights.forEach(bl => {
      (bl.material as THREE.MeshStandardMaterial).emissiveIntensity =
        isBraking ? 3.0 : 1.5;
    });

    this.isDrifting = this.keys[' '] && Math.abs(this.velocity.z) > 10;
    this.driftFactor = THREE.MathUtils.lerp(
      this.driftFactor,
      this.isDrifting ? CONFIG.CAR.DRIFT_SLIP : 1.0,
      0.1
    );

    if (this.keys['w'] || this.keys['arrowup']) {
      this.velocity.z += this.acceleration * delta;
    } else if (isBraking) {
      this.velocity.z -= this.acceleration * delta;
    }

    if (Math.abs(this.velocity.z) > 0.1) {
      const turnMult = (this.isDrifting ? 2.0 : 1.0) * Math.sign(this.velocity.z);
      if (this.keys['a'] || this.keys['arrowleft']) this.angle += this.steeringAmount * turnMult;
      if (this.keys['d'] || this.keys['arrowright']) this.angle -= this.steeringAmount * turnMult;
    }

    if (this.isRolling) {
      this.barrelRollAngle += delta * 15 * this.rollDirection;
      if (Math.abs(this.barrelRollAngle) >= Math.PI * 2) {
        this.barrelRollAngle = 0;
        this.isRolling = false;
      }
    }

    this.velocity.z *= this.deceleration;
    if (this.velocity.z > this.maxSpeed) this.velocity.z = this.maxSpeed;
    if (this.velocity.z < -this.maxSpeed / 2) this.velocity.z = -this.maxSpeed / 2;

    if (this.wheels.length > 0) {
      const wheelRot = (this.velocity.z * delta) / 0.5;
      this.wheels.forEach(w => { w.rotation.x += wheelRot; });
    }

    this.mesh.rotation.y = this.angle;

    const moveX = Math.sin(this.angle) * this.velocity.z * delta * this.driftFactor;
    const moveZ = Math.cos(this.angle) * this.velocity.z * delta * this.driftFactor;
    this.mesh.position.x += moveX;
    this.mesh.position.z += moveZ;

    this.gravityDir = THREE.MathUtils.lerp(this.gravityDir, this.isAntiGravity ? -1 : 1, 0.1);
    const height = Math.max(getHeight(this.mesh.position.x, this.mesh.position.z), 0);
    const targetY = this.isAntiGravity ? height + 10 : height + 0.1;
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, 0.4);

    const targetTilt = -(this.keys['a'] ? 0.08 : 0) + (this.keys['d'] ? 0.08 : 0);
    const targetRoll = (this.isAntiGravity ? Math.PI : 0) + this.barrelRollAngle + targetTilt;
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, 0.1);

    this.trailColor.setHex(0xffffff).multiplyScalar(0.4);
  }

  public getCameraTransform() {
    const horizontalOffset = 14;
    const height = 4.5;

    const breathe = Math.sin(Date.now() * 0.001 * (CONFIG.VISUALS.CAM_BREATH_SPEED ?? 0.3))
      * (CONFIG.VISUALS.CAM_BREATH_AMP ?? 0.08);

    const offset = new THREE.Vector3(
      Math.sin(this.angle) * -horizontalOffset,
      height + breathe,
      Math.cos(this.angle) * -horizontalOffset
    );

    const lookTarget = this.mesh.position.clone().add(
      new THREE.Vector3(Math.sin(this.angle) * 8, 1.5, Math.cos(this.angle) * 8)
    );

    return {
      position: this.mesh.position.clone().add(offset),
      lookTarget
    };
  }
}
