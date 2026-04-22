import * as THREE from 'three';
import { CONFIG } from '../config';

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

  public trailColor: THREE.Color = new THREE.Color(0x00f3ff);
  
  // Anti-Gravity
  public isAntiGravity: boolean = false;
  private gravityDir: number = 1;

  constructor() {
    this.mesh = new THREE.Group();
    this.createModel();
    this.setupInput();
  }

  private createModel() {
    // Car Body - A sleek box for now, will polish later
    const bodyGeometry = new THREE.BoxGeometry(2, 0.5, 4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x00f3ff,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.2,
      metalness: 0.8,
      roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.castShadow = true;
    body.position.y = 0.5;
    this.mesh.add(body);

    // Cab
    const cabGeometry = new THREE.BoxGeometry(1.5, 0.6, 2);
    const cabMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x111111,
      metalness: 0.9,
      roughness: 0.1
    });
    const cab = new THREE.Mesh(cabGeometry, cabMaterial);
    cab.position.y = 1.05;
    cab.position.z = -0.5;
    this.mesh.add(cab);

    // Headlights (Glow)
    const lightGeo = new THREE.BoxGeometry(0.5, 0.2, 0.1);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    const l1 = new THREE.Mesh(lightGeo, lightMat);
    l1.position.set(0.6, 0.5, 2.01);
    this.mesh.add(l1);

    const l2 = l1.clone();
    l2.position.set(-0.6, 0.5, 2.01);
    this.mesh.add(l2);
  }

  private setupInput() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
      
      // Double tap A
      if (e.key.toLowerCase() === 'a') {
        const now = Date.now();
        if (now - this.lastTapA < 300) this.startBarrelRoll(-1);
        this.lastTapA = now;
      }
      // Double tap D
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
    // Drifting
    this.isDrifting = this.keys[' '] && Math.abs(this.velocity.z) > 10;
    this.driftFactor = THREE.MathUtils.lerp(this.driftFactor, this.isDrifting ? CONFIG.CAR.DRIFT_SLIP : 1.0, 0.1);

    // Acceleration
    if (this.keys['w'] || this.keys['arrowup']) {
      this.velocity.z += this.acceleration * delta * (this.isDrifting ? 0.5 : 1.0);
    } else if (this.keys['s'] || this.keys['arrowdown']) {
      this.velocity.z -= this.acceleration * delta;
    }

    // Steering with drift slide
    if (Math.abs(this.velocity.z) > 0.1) {
      let turnMult = (this.isDrifting ? 2.5 : 1.0) * Math.sign(this.velocity.z);
      if (this.keys['a'] || this.keys['arrowleft']) {
        this.angle += this.steeringAmount * turnMult;
      }
      if (this.keys['d'] || this.keys['arrowright']) {
        this.angle -= this.steeringAmount * turnMult;
      }
    }

    // Barrel Roll Animation
    if (this.isRolling) {
      this.barrelRollAngle += delta * 10 * this.rollDirection;
      if (Math.abs(this.barrelRollAngle) >= Math.PI * 2) {
        this.barrelRollAngle = 0;
        this.isRolling = false;
      }
    }

    // Apply Deceleration (Friction)
    this.velocity.z *= this.isDrifting ? 0.995 : this.deceleration;

    // Limit Max Speed
    if (this.velocity.z > this.maxSpeed) this.velocity.z = this.maxSpeed;
    if (this.velocity.z < -this.maxSpeed / 2) this.velocity.z = -this.maxSpeed / 2;

    // Update Mesh position and rotation
    this.mesh.rotation.y = this.angle;
    
    // Slide physics during drift
    const moveX = Math.sin(this.angle) * this.velocity.z * delta * this.driftFactor;
    const moveZ = Math.cos(this.angle) * this.velocity.z * delta * this.driftFactor;
    
    this.mesh.position.x += moveX;
    this.mesh.position.z += moveZ;

    // Update Y position based on terrain/ceiling
    this.gravityDir = THREE.MathUtils.lerp(this.gravityDir, this.isAntiGravity ? -1 : 1, 0.1);
    const height = getHeight(this.mesh.position.x, this.mesh.position.z);
    
    const targetY = this.isAntiGravity ? height + 10 : height + 0.5;
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, targetY, 0.1);

    // Subtle tilting + Barrel Roll
    let targetTilt = -(this.keys['a'] ? 0.1 : 0) + (this.keys['d'] ? 0.1 : 0);
    if (this.isDrifting) targetTilt *= 3;
    
    // Flip rotation when anti-gravity is on
    const targetRoll = (this.isAntiGravity ? Math.PI : 0) + this.barrelRollAngle + targetTilt;
    this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, targetRoll, 0.1);

    // Trail Color update
    const speed = Math.abs(this.velocity.z);
    if (speed < 30) this.trailColor.setHex(0x00f3ff); // Cyan
    else if (speed < 55) this.trailColor.setHex(0xff00ff); // Magenta
    else this.trailColor.setHex(0xffffff); // White
  }

  public getCameraTransform() {
    const horizontalOffset = 15;
    const height = 5 + (Math.abs(this.velocity.z) / 20);
    
    const offset = new THREE.Vector3(
      Math.sin(this.angle) * -horizontalOffset,
      height,
      Math.cos(this.angle) * -horizontalOffset
    );

    const lookTarget = this.mesh.position.clone().add(
      new THREE.Vector3(Math.sin(this.angle) * 10, 2, Math.cos(this.angle) * 10)
    );

    return {
      position: this.mesh.position.clone().add(offset),
      lookTarget: lookTarget
    };
  }
}
