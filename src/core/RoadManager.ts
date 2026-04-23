import * as THREE from 'three';

/**
 * RoadManager creates and animates the road to simulate motion.
 * Uses texture offsetting and segment recycling for stability.
 */
export class RoadManager {
  private scene: THREE.Scene;
  private roadGroup: THREE.Group;
  private roadMaterial: THREE.MeshStandardMaterial;
  private roadMesh: THREE.Mesh;
  public speed: number = 40;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.roadGroup = new THREE.Group();
    
    // Create Road Material (Dark, slightly reflective)
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x050505,
      metalness: 0.5,
      roughness: 0.2,
    });

    // Create a large plane for the road
    const geometry = new THREE.PlaneGeometry(12, 1000, 1, 1);
    this.roadMesh = new THREE.Mesh(geometry, this.roadMaterial);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.position.z = 450; 
    this.roadMesh.receiveShadow = true;
    
    this.roadGroup.add(this.roadMesh);
    this.scene.add(this.roadGroup);

    // Add road markings or texture if needed
    this.addMarkings();
  }

  private addMarkings(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, 512, 1024);
      
      // Dashed line in middle
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 15;
      ctx.setLineDash([60, 60]); // Longer dashes for high speed
      ctx.beginPath();
      ctx.moveTo(256, 0);
      ctx.lineTo(256, 1024);
      ctx.stroke();

      // Side lines (continuous)
      ctx.setLineDash([]);
      ctx.lineWidth = 20;
      ctx.beginPath();
      ctx.moveTo(20, 0); ctx.lineTo(20, 1024);
      ctx.moveTo(492, 0); ctx.lineTo(492, 1024);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 40); // More frequent repeats for speed reference
    
    this.roadMaterial.map = texture;
    this.roadMaterial.needsUpdate = true;
  }

  /**
   * Animates the road by offsetting the texture.
   */
  public update(delta: number): void {
    if (this.roadMaterial.map) {
      this.roadMaterial.map.offset.y += (this.speed * delta) / 50;
    }
  }
}
