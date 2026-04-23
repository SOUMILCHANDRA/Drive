import * as THREE from 'three';

/**
 * RoadManager: Dark PBR Asphalt and Infinite Texture Flow.
 */
export class RoadManager {
  private scene: THREE.Scene;
  private roadMaterial: THREE.MeshStandardMaterial;
  public speed: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Dark Asphalt PBR (Calibrated for headlights)
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x050505, 
      metalness: 0.4, // Lowered for less mirror-like reflection
      roughness: 0.5, // Increased for realistic asphalt texture
    });

    const geometry = new THREE.PlaneGeometry(16, 2000); // Extended for better horizon
    const mesh = new THREE.Mesh(geometry, this.roadMaterial);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.z = 950; // Centered for long view distance
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.setupMarkings();
  }

  private setupMarkings(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, 512, 1024);
      ctx.strokeStyle = '#555555'; ctx.lineWidth = 15;
      ctx.setLineDash([40, 60]);
      ctx.beginPath(); ctx.moveTo(256, 0); ctx.lineTo(256, 1024); ctx.stroke();
      ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, 1024); ctx.moveTo(492, 0); ctx.lineTo(492, 1024); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 40);
    this.roadMaterial.map = texture;
  }

  public update(delta: number): void {
    if (this.roadMaterial.map) {
      this.roadMaterial.map.offset.y += (this.speed * delta) / 40;
    }
  }
}
