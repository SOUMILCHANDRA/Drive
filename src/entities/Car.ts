import * as THREE from 'three';

export class Car {
  public mesh: THREE.Group;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public acceleration: number = 20;
  public deceleration: number = 0.98;
  public maxSpeed: number = 60;
  public steeringAmount: number = 0.05;
  public angle: number = 0;

  private keys: Record<string, boolean> = {};

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
    window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);
  }

  public update(delta: number, getHeight: (x: number, z: number) => number) {
    // Acceleration
    if (this.keys['w'] || this.keys['arrowup']) {
      this.velocity.z += this.acceleration * delta;
    } else if (this.keys['s'] || this.keys['arrowdown']) {
      this.velocity.z -= this.acceleration * delta;
    }

    // Steering
    if (Math.abs(this.velocity.z) > 0.1) {
      if (this.keys['a'] || this.keys['arrowleft']) {
        this.angle += this.steeringAmount * Math.sign(this.velocity.z);
      }
      if (this.keys['d'] || this.keys['arrowright']) {
        this.angle -= this.steeringAmount * Math.sign(this.velocity.z);
      }
    }

    // Apply Deceleration (Friction)
    this.velocity.z *= this.deceleration;

    // Limit Max Speed
    if (this.velocity.z > this.maxSpeed) this.velocity.z = this.maxSpeed;
    if (this.velocity.z < -this.maxSpeed / 2) this.velocity.z = -this.maxSpeed / 2;

    // Update Mesh
    this.mesh.rotation.y = this.angle;
    
    // Move in direction of rotation
    const moveX = Math.sin(this.angle) * this.velocity.z * delta;
    const moveZ = Math.cos(this.angle) * this.velocity.z * delta;
    
    this.mesh.position.x += moveX;
    this.mesh.position.z += moveZ;

    // Update Y position based on terrain
    const height = getHeight(this.mesh.position.x, this.mesh.position.z);
    this.mesh.position.y = THREE.MathUtils.lerp(this.mesh.position.y, height + 0.5, 0.1);

    // Subtle tilting when steering
    this.mesh.rotation.z = - (this.keys['a'] ? 0.05 : 0) + (this.keys['d'] ? 0.05 : 0);
  }
}
