import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export const getWorldX = (z: number) => {
    return Math.sin(z * 0.003) * 25;
};

export const getWorldHeight = (x: number, z: number) => {
    const xCurve = getWorldX(z);
    const distFromRoad = Math.abs(x - xCurve);
    if (distFromRoad < 12) return 0;
    const shoulderFactor = Math.min(1, (distFromRoad - 12) / 8);
    const plainH = noise2D(x * 0.01, z * 0.005) * 4;
    return plainH * shoulderFactor;
};

export class Road {
  private scene: THREE.Scene;
  private roadMesh: THREE.Mesh;
  private roadMaterial: THREE.MeshStandardMaterial;
  public speed: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x1C1C24,
      metalness: 0.9,
      roughness: 0.1,
    });

    const geometry = new THREE.PlaneGeometry(24, 1200, 1, 120);
    this.roadMesh = new THREE.Mesh(geometry, this.roadMaterial);
    this.roadMesh.rotation.x = -Math.PI / 2;
    this.roadMesh.position.y = 0.02;
    this.scene.add(this.roadMesh);

    this.setupMarkings();
  }

  private setupMarkings(): void {
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#1C1C24'; ctx.fillRect(0, 0, 1024, 2048);
      for (let i = 0; i < 50000; i++) {
          ctx.fillStyle = `rgba(200,200,255,${Math.random() * 0.1})`;
          ctx.fillRect(Math.random() * 1024, Math.random() * 2048, 1, 3);
      }
      ctx.setLineDash([80, 120]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 10;
      [256, 512, 768].forEach(x => {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 2048); ctx.stroke();
      });
      ctx.setLineDash([]);
      ctx.strokeStyle = '#F4B942'; ctx.lineWidth = 15;
      ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(20, 2048); ctx.moveTo(1004, 0); ctx.lineTo(1004, 2048); ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 40);
    texture.anisotropy = 16;
    this.roadMaterial.map = texture;
  }

  public update(totalDistance: number, delta: number): void {
    if (this.roadMaterial.map) this.roadMaterial.map.offset.y += (this.speed * delta) / 30;
    const pos = this.roadMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const isRight = i % 2 !== 0;
        const xBase = isRight ? 12 : -12;
        const zWorld = pos.getY(i) + 400 + totalDistance;
        const xCurve = getWorldX(zWorld);
        const yWorld = getWorldHeight(xBase + xCurve, zWorld);
        pos.setX(i, xBase + xCurve);
        pos.setZ(i, yWorld);
    }
    pos.needsUpdate = true;
  }
}
