import * as THREE from 'three';

export type NeonState = 'STEADY' | 'FLICKERING' | 'OFF';

/**
 * NeonSign: An atmospheric nocturnal emissive neon sign with a
 * per-sign flicker state machine (Drive 2011 neon aesthetic).
 */
export class NeonSign extends THREE.Group {
  private glowMesh: THREE.Mesh;
  private boardMesh: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;
  
  public color: THREE.Color;
  public effectiveIntensity: number = 1.0;

  // Flicker State Machine
  private state: NeonState = 'STEADY';
  private stateTimer: number = 0;
  private nextFlickerTime: number = 3 + Math.random() * 8;
  private flickerDuration: number = 0;
  private isDefective: boolean = Math.random() < 0.25;

  private static COLORS = [
    0xff2d78, // Hot Pink (Drive signature)
    0x00ffef, // Neon Cyan
    0xffaa00, // Sodium Amber
    0x39ff14, // Acid Green
    0xff3366  // Neon Magenta
  ];
  private static TEXTS = ['MOTEL', 'OPEN', 'BAR', '24HR', 'GAS', 'PARK', 'EATS', 'DRIVE', 'HOTEL'];

  constructor() {
    super();
    const colorVal = NeonSign.COLORS[Math.floor(Math.random() * NeonSign.COLORS.length)];
    const text = NeonSign.TEXTS[Math.floor(Math.random() * NeonSign.TEXTS.length)];
    this.color = new THREE.Color(colorVal);
    
    // 1. Backing Board
    const boardGeo = new THREE.PlaneGeometry(text.length * 0.6 + 0.4, 1.2);
    const boardMat = new THREE.MeshBasicMaterial({ color: 0x05050a });
    this.boardMesh = new THREE.Mesh(boardGeo, boardMat);
    this.add(this.boardMesh);
    
    // 2. Glowing Neon Text Plane
    this.mat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.95,
      toneMapped: false // Glows directly into the bloom pass
    });
    
    this.glowMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(text.length * 0.55, 0.85),
      this.mat
    );
    this.glowMesh.position.z = 0.02;
    this.add(this.glowMesh);
  }

  public update(dt: number): void {
    this.stateTimer += dt;

    switch (this.state) {
      case 'STEADY':
        // Subtle 60Hz electrical hum buzz
        const buzz = Math.sin(Date.now() * 0.06) * 0.05;
        this.effectiveIntensity = 1.0 + buzz;

        if (this.stateTimer >= this.nextFlickerTime) {
          this.state = 'FLICKERING';
          this.stateTimer = 0;
          this.flickerDuration = this.isDefective ? (0.4 + Math.random() * 0.8) : (0.1 + Math.random() * 0.25);
        }
        break;

      case 'FLICKERING':
        // Rapid chaotic flicker sequence
        const rand = Math.random();
        this.effectiveIntensity = rand > 0.4 ? (0.8 + rand * 0.4) : (rand * 0.15);

        if (this.stateTimer >= this.flickerDuration) {
          if (this.isDefective && Math.random() < 0.3) {
            this.state = 'OFF';
            this.stateTimer = 0;
            this.flickerDuration = 0.5 + Math.random() * 1.5;
          } else {
            this.state = 'STEADY';
            this.stateTimer = 0;
            this.nextFlickerTime = 4 + Math.random() * 10;
            this.effectiveIntensity = 1.0;
          }
        }
        break;

      case 'OFF':
        this.effectiveIntensity = 0.05;
        if (this.stateTimer >= this.flickerDuration) {
          this.state = 'STEADY';
          this.stateTimer = 0;
          this.nextFlickerTime = 3 + Math.random() * 6;
          this.effectiveIntensity = 1.0;
        }
        break;
    }

    this.mat.opacity = Math.max(0.05, Math.min(1.0, this.effectiveIntensity));
  }

  public dispose(): void {
    if (this.glowMesh.geometry) this.glowMesh.geometry.dispose();
    if (this.boardMesh.geometry) this.boardMesh.geometry.dispose();
    this.mat.dispose();
  }
}
