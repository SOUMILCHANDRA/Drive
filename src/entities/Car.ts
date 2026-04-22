import * as THREE from 'three';
import { CONFIG } from '../config';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

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
  
  // Advanced Physics
  public driftFactor: number = 1.0;
  public isDrifting: boolean = false;
  private lastTapA: number = 0;
  private lastTapD: number = 0;
  public barrelRollAngle: number = 0;
  private isRolling: boolean = false;
  private rollDirection: number = 0;

  public trailColor: THREE.Color = new THREE.Color(0xffffff);
  
  // Anti-Gravity
  public isAntiGravity: boolean = false;
  private gravityDir: number = 1;
  
  private headlightTargets: THREE.Object3D[] = [];
  
  // Wheels for animation
  private wheels: THREE.Object3D[] = [];

  constructor() {
    this.mesh = new THREE.Group();
    this.setupInput();
  }

  public async init() {
    try {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync('/models/car/scene.gltf');
      
      const loadedModel = gltf.scene;
      
      // We assume the model needs scaling. The user can adjust if needed.
      loadedModel.scale.set(0.8, 0.8, 0.8);
      loadedModel.position.y = 0.3; // slightly lift it up
      
      // Setup shadows and find wheels
      loadedModel.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
        // Very basic wheel detection by name, might need adjusting based on the specific Sketchfab model
        if (child.name.toLowerCase().includes('wheel') || child.name.toLowerCase().includes('tire')) {
            this.wheels.push(child);
        }
      });
      
      this.mesh.add(loadedModel);
      this.attachLights();
    } catch (e) {
      console.warn("Could not load 3D model, falling back to procedural car.", e);
      this.createProceduralModel();
    }
  }

  private createProceduralModel() {
    // Body: Dark Charcoal Industrial Design
    const bodyGeometry = new THREE.BoxGeometry(2.1, 0.6, 4.2);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: CONFIG.CAR.BODY_COLOR,
      metalness: 0.9,
      roughness: 0.25
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.position.y = 0.5;
    this.mesh.add(body);

    // Windshield: Physical/Translucent
    const cabGeometry = new THREE.BoxGeometry(1.6, 0.7, 1.8);
    const cabMaterial = new THREE.MeshPhysicalMaterial({ 
      color: 0x000000,
      metalness: 0,
      roughness: 0.05,
      transmission: 0.6,
      thickness: 0.5,
      reflectivity: 1.0
    });
    const cab = new THREE.Mesh(cabGeometry, cabMaterial);
    cab.position.set(0, 1.1, -0.4);
    this.mesh.add(cab);
    
    this.attachLights();
  }

  private attachLights() {
    // Halogen Headlights (Cinematic SpotLights with Spread)
    const headlightColor = CONFIG.CAR.HEADLIGHT_COLOR;
    const createHeadlightGroup = (x: number) => {
      const container = new THREE.Group();
      container.position.set(x, 0.6, 2.1);

      // Primary Beam
      const spot = new THREE.SpotLight(headlightColor, CONFIG.LIGHTING.HEADLIGHT_INTENSITY);
      spot.angle = CONFIG.LIGHTING.HEADLIGHT_ANGLE;
      spot.distance = CONFIG.LIGHTING.HEADLIGHT_DISTANCE;
      spot.penumbra = CONFIG.LIGHTING.HEADLIGHT_PENUMBRA;
      spot.decay = 2;
      spot.castShadow = true;
      
      const target = new THREE.Object3D();
      // Target is relative to the car mesh, positioned 80 units ahead
      target.position.set(x, 0, 80);
      this.mesh.add(target); // Add to car mesh root
      
      spot.target = target;
      this.headlightTargets.push(target);

      // Outer Spread Beam (weaker)
      const outerSpot = new THREE.SpotLight(headlightColor, CONFIG.LIGHTING.HEADLIGHT_INTENSITY * 0.4);
      outerSpot.angle = CONFIG.LIGHTING.HEADLIGHT_ANGLE + 0.12;
      outerSpot.distance = 40; 
      outerSpot.penumbra = 0.8;
      
      const outerTarget = new THREE.Object3D();
      outerTarget.position.set(x > 0 ? 10 : -10, -2, 40);
      this.mesh.add(outerTarget);
      outerSpot.target = outerTarget;
      
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.15, 16, 16),
        new THREE.MeshBasicMaterial({ color: headlightColor })
      );
      
      container.add(spot);
      container.add(outerSpot);
      container.add(bulb);
      return container;
    };

    this.mesh.add(createHeadlightGroup(0.7));
    this.mesh.add(createHeadlightGroup(-0.7));

    // Underglow (Chassis silhouette)
    const underglow = new THREE.RectAreaLight(0x002233, 150, 2, 0.5);
    underglow.position.set(0, -0.4, 0);
    underglow.rotation.x = -Math.PI / 2;
    this.mesh.add(underglow);

    // Brake Lights (Subtle Red Emissive)
    const brakeGeo = new THREE.BoxGeometry(0.5, 0.15, 0.1);
    const brakeMat = new THREE.MeshStandardMaterial({ 
      color: 0x550000, 
      emissive: 0xff0000, 
      emissiveIntensity: 10 
    });
    const b1 = new THREE.Mesh(brakeGeo, brakeMat);
    b1.position.set(0.7, 0.6, -2.1);
    this.mesh.add(b1);
    const b2 = b1.clone();
    b2.position.x = -0.7;
    this.mesh.add(b2);
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
    this.isDrifting = this.keys[' '] && Math.abs(this.velocity.z) > 10;
    this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, this.isDrifting ? CONFIG.CAR.DRIFT_SLIP : 1.0, 0.1);

    if (this.keys['w'] || this.keys['arrowup']) {
      this.velocity.z += this.acceleration * delta;
    } else if (this.keys['s'] || this.keys['arrowdown']) {
      this.velocity.z -= this.acceleration * delta;
    }

    if (Math.abs(this.velocity.z) > 0.1) {
      let turnMult = (this.isDrifting ? 2.0 : 1.0) * Math.sign(this.velocity.z);
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
    
    // Rotate wheels based on velocity
    if (this.wheels.length > 0) {
        const wheelRotation = (this.velocity.z * delta) / 0.5; // Assumed radius of 0.5
        this.wheels.forEach(wheel => {
            wheel.rotation.x += wheelRotation; // Depending on model's axis
        });
    }

    this.mesh.rotation.y = this.angle;
    
    const moveX = Math.sin(this.angle) * this.velocity.z * delta * this.driftFactor;
    const moveZ = Math.cos(this.angle) * this.velocity.z * delta * this.driftFactor;
    
    this.mesh.position.x += moveX;
    this.mesh.position.z += moveZ;

    this.gravityDir = THREE.MathUtils.lerp(this.gravityDir, this.isAntiGravity ? -1 : 1, 0.1);
    const height = Math.max(getHeight(this.mesh.position.x, this.mesh.position.z), 0); // clamp to 0 if under terrain
    const targetY = this.isAntiGravity ? height + 10 : height + 0.2;
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, 0.1);

    let targetTilt = -(this.keys['a'] ? 0.08 : 0) + (this.keys['d'] ? 0.08 : 0);
    const targetRoll = (this.isAntiGravity ? Math.PI : 0) + this.barrelRollAngle + targetTilt;
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, 0.1);

    // Trail Color update
    this.trailColor.setHex(0xffffff).multiplyScalar(0.4);
  }

  public getCameraTransform() {
    const horizontalOffset = 14;
    const height = 4.5;
    
    const offset = new THREE.Vector3(
      Math.sin(this.angle) * -horizontalOffset,
      height + Math.sin(Date.now() * 0.001 * CONFIG.VISUALS.CAM_BREATH_SPEED) * CONFIG.VISUALS.CAM_BREATH_AMP,
      Math.cos(this.angle) * -horizontalOffset
    );

    const lookTarget = this.mesh.position.clone().add(
      new THREE.Vector3(Math.sin(this.angle) * 8, 1.5, Math.cos(this.angle) * 8)
    );

    return {
      position: this.mesh.position.clone().add(offset),
      lookTarget: lookTarget
    };
  }
}
