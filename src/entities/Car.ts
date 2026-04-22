import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

RectAreaLightUniformsLib.init();

/**
 * Represents the player vehicle with cinematic physics and camera logic.
 * Implements vintage suspension bobbing and stable spline-based grounding.
 */
export class Car {
  public mesh: THREE.Group;
  public inputX: number = 0; // Visual steering
  public currentSpeed: number = 0; // Just for UI/Autopilot logic

  private keys: Record<string, boolean> = {};
  private brakeLights: THREE.Mesh[] = [];
  private model: THREE.Group | null = null;
  private currentCameraPos: THREE.Vector3 = new THREE.Vector3(0, 10, -20);

  private raycaster: THREE.Raycaster = new THREE.Raycaster();

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
                    color: 0x999999,
                    roughness: 0.35,
                    metalness: 0.7
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
    const headlight = new THREE.SpotLight(0xffcc88, 20, 80);
    headlight.position.set(0, 1, 2);
    headlight.target.position.set(0, 0, 10);
    headlight.castShadow = true;

    this.mesh.add(headlight);
    this.mesh.add(headlight.target);

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
    return this.currentSpeed;
  }

  /**
   * Main update loop for manual driving.
   */
  /**
   * Main update loop for visual driving.
   */
  public update(delta: number) {
    const isBraking = this.keys['s'] || this.keys['arrowdown'];
    this.brakeLights.forEach(bl => (bl.material as THREE.MeshStandardMaterial).emissiveIntensity = isBraking ? 10 : 3);

    // Speed logic is purely scalar for distance calculation in main.ts
    if (this.keys['w'] || this.keys['arrowup']) {
        this.currentSpeed = Math.min(this.currentSpeed + 50 * delta, 200);
    } else if (isBraking) {
        this.currentSpeed = Math.max(this.currentSpeed - 100 * delta, 0);
    } else {
        this.currentSpeed = Math.max(this.currentSpeed - 20 * delta, 0);
    }

    // Input X Logic
    if (this.currentSpeed > 0) {
      if (this.keys['a'] || this.keys['arrowleft']) this.inputX += 0.5 * delta;
      if (this.keys['d'] || this.keys['arrowright']) this.inputX -= 0.5 * delta;
    }
    
    // Auto-center steering
    if (!this.keys['a'] && !this.keys['arrowleft'] && !this.keys['d'] && !this.keys['arrowright']) {
        this.inputX = THREE.MathUtils.lerp(this.inputX, 0, 0.1);
    }
    
    this.inputX = THREE.MathUtils.clamp(this.inputX, -2, 2);

    // PURE VISUAL LERP: Car stays at Z=0.
    this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, this.inputX * 5, 0.1);
    this.mesh.rotation.z = -this.mesh.position.x * 0.05; // Fake tilt
    this.mesh.rotation.y = this.inputX * 0.2; // Fake steering visually
    
    // Fixed height offset (-0.6)
    const time = Date.now() * 0.003;
    const bobbing = Math.sin(time) * 0.01; 
    this.mesh.position.y = -0.6 + bobbing;
  }

  /**
   * Logic for autonomous spline following.
   */
  public autopilot() {
    this.currentSpeed = 100;
    this.mesh.position.x = THREE.MathUtils.lerp(this.mesh.position.x, 0, 0.1);
    this.mesh.position.y = -0.6;
    this.mesh.rotation.z = 0;
    this.mesh.rotation.y = 0;
  }

  public getCameraTransform() {
    const targetCamPos = new THREE.Vector3(0, 2, -6);
    this.currentCameraPos.lerp(targetCamPos, 0.08);

    const lookTarget = new THREE.Vector3(0, 1, 5);
    
    return { position: this.currentCameraPos.clone(), lookTarget };
  }
}
