import * as THREE from 'three';

/**
 * NeonSign: A living, flickering light source for the Nightcall city.
 */
export class NeonSign extends THREE.Group {
  private glowMesh: THREE.Mesh;
  private pointLight: THREE.PointLight;
  private mat: THREE.MeshStandardMaterial;
  
  // Flicker Data
  private baseIntensity: number = 2.5;
  private timer: number = Math.random() * 10;
  private flickerInterval: number = 4 + Math.random() * 8;
  private broken: boolean = Math.random() < 0.2;
  
  public color: THREE.Color;

  private static COLORS = [0xff2d78, 0x00ffef, 0xf4b942, 0x39ff14, 0xff6600];
  private static TEXTS = ['MOTEL', 'OPEN', 'BAR', '24HR', 'GAS', 'PARK', 'EATS'];

  constructor() {
    super();
    const colorVal = NeonSign.COLORS[Math.floor(Math.random() * NeonSign.COLORS.length)];
    const text = NeonSign.TEXTS[Math.floor(Math.random() * NeonSign.TEXTS.length)];
    this.color = new THREE.Color(colorVal);
    
    // 1. Backing Board
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(text.length * 0.6 + 0.4, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 1.0 })
    );
    this.add(board);
    
    // 2. Glowing Text Plane
    this.mat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: this.color,
      emissiveIntensity: this.baseIntensity,
      transparent: true,
      opacity: 0.95,
    });
    
    this.glowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(text.length * 0.55, 0.9),
      this.mat
    );
    this.glowMesh.position.z = 0.02;
    this.add(this.glowMesh);
    
    // 3. Point light for sign illumination
    this.pointLight = new THREE.PointLight(colorVal, 1.8, 18, 2);
    this.pointLight.position.set(0, 0, 1.5);
    this.add(this.pointLight);
  }

  public update(dt: number): void {
    this.timer += dt;
    
    if (this.timer > this.flickerInterval) {
      this.timer = 0;
      // Randomized Flicker Event
      const isOff = this.broken ? (Math.random() < 0.4) : (Math.random() < 0.05);
      const targetIntensity = isOff ? 0 : this.baseIntensity;
      
      this.mat.emissiveIntensity = targetIntensity;
      this.pointLight.intensity = isOff ? 0 : 1.8;
      
      // Auto-restore after brief flicker
      if (isOff) {
          setTimeout(() => {
              this.mat.emissiveIntensity = this.baseIntensity;
              this.pointLight.intensity = 1.8;
          }, 50 + Math.random() * 150);
      }
    }
    
    // Subtle buzz hum (sub-perceptual intensity modulation)
    if (this.mat.emissiveIntensity > 0) {
        this.mat.emissiveIntensity = this.baseIntensity + (Math.sin(Date.now() * 0.05) * 0.2);
    }
  }
}
