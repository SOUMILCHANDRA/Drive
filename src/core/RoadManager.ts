import * as THREE from 'three';

/**
 * WorldCurve: Shared path definition.
 */
export const getWorldX = (z: number) => {
    return Math.sin(z * 0.006) * 18 + Math.sin(z * 0.015) * 6;
};

/**
 * RoadManager: Infinite recycling road with robust winding.
 */
export class RoadManager {
  private scene: THREE.Scene;
  private roadGroup: THREE.Group;
  private roadMaterial: THREE.MeshStandardMaterial;
  private roadMesh: THREE.Mesh;
  public speed: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x050508,
      metalness: 0.4,
      roughness: 0.5,
    });

    // Create a long road segment
    const geometry = new THREE.PlaneGeometry(12, 1200, 1, 120);
    this.roadMesh = new THREE.Mesh(geometry, this.roadMaterial);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.receiveShadow = true;
    this.roadGroup.add(this.roadMesh);

    this.setupMarkings();
  }

  private setupMarkings(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#050508'; ctx.fillRect(0, 0, 512, 1024);
      for (let i = 0; i < 20000; i++) {
          ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.04})`;
          ctx.fillRect(Math.random() * 512, Math.random() * 1024, 2, 2);
      }
      ctx.strokeStyle = '#e0e0ff'; ctx.lineWidth = 10;
      ctx.beginPath(); ctx.moveTo(250, 0); ctx.lineTo(250, 1024); ctx.moveTo(262, 0); ctx.lineTo(262, 1024); ctx.stroke();
      ctx.strokeStyle = '#666677'; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, 1024); ctx.moveTo(492, 0); ctx.lineTo(492, 1024); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 60);
    texture.anisotropy = 16;
    this.roadMaterial.map = texture;
  }

  public update(totalDistance: number, delta: number): void {
    // 1. Move road locally for texture flow
    if (this.roadMaterial.map) {
      this.roadMaterial.map.offset.y += (this.speed * delta) / 20;
    }

    // 2. Update vertices based on total world distance
    const pos = this.roadMesh.geometry.attributes.position;
    const width = 12;
    for (let i = 0; i < pos.count; i++) {
        const isRight = i % 2 !== 0;
        const xBase = isRight ? width/2 : -width/2;
        const localZ = pos.getY(i); // This is Z in world after rotation
        
        // worldZ is the absolute distance from the start of the journey
        const worldZ = localZ + 400 + totalDistance; 
        
        const xCurve = getWorldX(worldZ);
        pos.setX(i, xBase + xCurve);
    }
    pos.needsUpdate = true;
  }
}
