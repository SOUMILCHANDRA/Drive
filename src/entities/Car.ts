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

  public driftFactor: number = 1.0;
  public isDrifting: boolean = false;
  public barrelRollAngle: number = 0;

  private wheels: THREE.Object3D[] = [];
  private brakeLights: THREE.Mesh[] = [];

  constructor() {
    this.mesh = new THREE.Group();
    this.setupInput();
  }

  public async init() {
    // DEBUG: Force procedural car immediately to fix black screen hang
    this.createProceduralModel();
    console.log("Drive: Procedural Car Forced");
  }

  private createProceduralModel() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 1 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 4.5), mat);
    body.position.y = 0.5;
    this.mesh.add(body);
    this.attachLights();
  }

  private attachLights() {
    const headlightColor = 0xfff2d0;
    const createHeadlight = (x: number) => {
      const spot = new THREE.SpotLight(headlightColor, 100, 150, 0.4, 0.5, 1);
      spot.position.set(x, 0.6, 2.1);
      const target = new THREE.Object3D();
      target.position.set(x, -2, 80);
      this.mesh.add(target);
      spot.target = target;
      this.mesh.add(spot);
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
    this.mesh.rotation.y = this.angle;
    this.mesh.position.x += Math.sin(this.angle) * this.velocity.z * delta;
    this.mesh.position.z += Math.cos(this.angle) * this.velocity.z * delta;

    const height = Math.max(getHeight(this.mesh.position.x, this.mesh.position.z), 0);
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, height + 0.1, 0.4);
    
    if (this.wheels.length > 0) {
      this.wheels.forEach(w => w.rotation.x += (this.velocity.z * delta) / 0.5);
    }
  }

  public getCameraTransform() {
    const offset = new THREE.Vector3(Math.sin(this.angle) * -14, 4.5, Math.cos(this.angle) * -14);
    const lookTarget = this.mesh.position.clone().add(new THREE.Vector3(Math.sin(this.angle) * 8, 1.5, Math.cos(this.angle) * 8));
    return { position: this.mesh.position.clone().add(offset), lookTarget };
  }
}
