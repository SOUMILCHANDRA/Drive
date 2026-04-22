import * as THREE from 'three';
import { CONFIG } from '../config';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

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
  private brakeLights: THREE.Mesh[] = [];

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private normal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  constructor() {
    this.mesh = new THREE.Group();
    this.setupInput();
    this.raycaster.far = 10;
  }

  public async init() {
    this.createProceduralModel();
    console.log("Drive: Grounded Car Initialized");
  }

  private createProceduralModel() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4.5), mat);
    body.position.y = 0.5;
    body.castShadow = true;
    this.mesh.add(body);
    this.attachLights();
  }

  private attachLights() {
    const headlightColor = 0xFFD700; // Drive 2011 Warm Amber
    const createHeadlight = (x: number) => {
      const spot = new THREE.SpotLight(headlightColor, 2000, 200, 0.6, 0.8, 1.0);
      spot.position.set(x, 0.6, 4.1);
      spot.castShadow = true;
      spot.shadow.mapSize.width = 1024;
      spot.shadow.mapSize.height = 1024;

      const target = new THREE.Object3D();
      target.position.set(x, -0.5, 60);
      this.mesh.add(target);
      spot.target = target;
      this.mesh.add(spot);

      const glow = new THREE.PointLight(headlightColor, 40, 15, 1.0);
      glow.position.set(x, 0.6, 4.1);
      this.mesh.add(glow);
    };
    createHeadlight(0.8);
    createHeadlight(-0.8);

    const brakeMat = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff0000, emissiveIntensity: 2 });
    const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.1), brakeMat);
    b1.position.set(0.7, 0.6, -2.1);
    this.mesh.add(b1);
    this.brakeLights.push(b1);
    
    const b2 = b1.clone();
    b2.position.x = -0.7;
    this.mesh.add(b2);
    this.brakeLights.push(b2);
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
  }

  public get velocityValue(): number {
    return this.velocity.z;
  }

  public update(delta: number, getHeight: (x: number, z: number) => number) {
    const isBraking = this.keys['s'] || this.keys['arrowdown'];
    this.brakeLights.forEach(bl => (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = isBraking ? 5 : 1.5);

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

    // STABLE SPLINE ANCHOR: Height sampling + Offset
    const roadHeight = Math.max(getHeight(this.mesh.position.x, this.mesh.position.z), 0);
    const time = Date.now() * 0.003;
    const bobbing = Math.sin(time) * 0.05;
    
    // Smooth settling lerp
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, roadHeight + 0.5 + bobbing, 0.2);
    
    // Keep rotation stable
    this.mesh.rotation.y = this.angle;
    
    // Reset normal for stability
    this.normal.set(0, 1, 0);
  }

  public autopilot(targetX: number, targetZ: number, targetAngle: number, targetY: number) {
    this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, targetX, 0.1);
    this.mesh.position.z = targetZ;
    this.angle = THREE.MathUtils.lerp(this.angle, targetAngle, 0.1);
    this.velocity.z = 25;
    
    // Vertical stabilization
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY + 0.5, 0.2);
    this.mesh.rotation.y = this.angle;
  }

  public getCameraTransform() {
    // Focused Chase Camera
    const time = Date.now() * 0.01;
    const shake = new THREE.Vector3(
        Math.sin(time * 0.7) * 0.02,
        Math.cos(time * 0.8) * 0.02,
        0
    );

    // Dynamic offset based on car rotation
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.mesh.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.mesh.quaternion);
    
    const camPos = this.mesh.position.clone()
        .add(forward.clone().multiplyScalar(-7))
        .add(up.clone().multiplyScalar(2.5))
        .add(shake);

    const lookTarget = this.mesh.position.clone()
        .add(forward.clone().multiplyScalar(20))
        .add(up.clone().multiplyScalar(1.0));
    
    return { position: camPos, lookTarget };
  }
}
