import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { CONFIG } from '../config';

export class RoadManager {
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private noise: Noise;
  
  private points: THREE.Vector3[] = [];
  private chunks: Map<number, THREE.Group> = new Map();
  private chunkSize: number = 20;
  private roadWidth: number = CONFIG.ROAD.WIDTH;
  private renderDistance: number = 15;
  
  private spline: THREE.CatmullRomCurve3 | null = null;
  private roadMaterial: THREE.MeshStandardMaterial;
  private terrainMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a1a1b,
      roughness: 0.4,
      metalness: 0.3,
      side: THREE.DoubleSide
    });

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x050810,
      roughness: 0.9,
      metalness: 0
    });

    this.points.push(new THREE.Vector3(0, this.noise.get(0, -20, 4, 0.5, 0.005) * 50, -20));
    this.points.push(new THREE.Vector3(0, this.noise.get(0, 0, 4, 0.5, 0.005) * 50, 0));
    this.points.push(new THREE.Vector3(0, this.noise.get(0, 20, 4, 0.5, 0.005) * 50, 20));
    
    this.generateMorePoints(50);
  }

  private generateMorePoints(count: number) {
    let lastPoint = this.points[this.points.length - 1];
    let lastDir = new THREE.Vector3().subVectors(lastPoint, this.points[this.points.length - 2]).normalize();

    for (let i = 0; i < count; i++) {
        const index = this.points.length;
        const angle = (this.noise.get(index * 10, 0, 1, 0.5, 1) - 0.5) * 0.4;
        const pitch = (this.noise.get(0, index * 10, 1, 0.5, 1) - 0.5) * 0.1;

        const newDir = lastDir.clone()
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
            .applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
            .normalize();

        const newPoint = lastPoint.clone().add(newDir.multiplyScalar(this.chunkSize));
        newPoint.y = this.noise.get(newPoint.x, newPoint.z, 4, 0.5, 0.005) * 50;
        this.points.push(newPoint);
        lastPoint = newPoint;
        lastDir = newDir;
    }
  }

  private updateSpline() {
    // No longer using global spline for meshes
  }

  public getRoadHeight(_x: number, z: number): number {
    return this.noise.get(_x, z, 4, 0.5, 0.005) * 50;
  }

  public update(playerZ: number) {
    const currentChunkIndex = Math.floor(playerZ / this.chunkSize);
    
    for (let i = -1; i < this.renderDistance; i++) {
        const index = currentChunkIndex + i;
        if (index < 0) continue;
        if (!this.chunks.has(index)) this.createChunkMesh(index);
    }

    for (const [index, group] of this.chunks.entries()) {
      if (index < currentChunkIndex - 2 || index > currentChunkIndex + this.renderDistance) {
        this.roadGroup.remove(group);
        this.chunks.delete(index);
      }
    }

    if (playerZ > (this.points.length - 10) * this.chunkSize) {
        this.generateMorePoints(5);
        this.updateSpline();
    }
  }

  private createChunkMesh(index: number) {
    if (index < 0 || index >= this.points.length - 1) return;

    // Use local points for stable curve generation
    const p0 = this.points[Math.max(0, index - 1)];
    const p1 = this.points[index];
    const p2 = this.points[index + 1];
    const p3 = this.points[Math.min(this.points.length - 1, index + 2)];

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    // The segment between p1 and p2 is roughly t=1/3 to t=2/3 in a 4-point curve if distances are equal.
    // However, an easier way is to just create a curve from p1 to p2 and use start/end tangents.
    // Three.js CatmullRomCurve3 maps t=0 to the first point and t=1 to the last point, but if we want 
    // the segment between p1 and p2, we evaluate from t=1/3 to t=2/3.
    // Actually, to make it perfectly align, we extract the segment points:
    const segmentPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
        segmentPoints.push(curve.getPoint(1/3 + (i/10) * (1/3)));
    }
    
    const localCurve = new THREE.CatmullRomCurve3(segmentPoints);
    const geometry = new THREE.TubeGeometry(localCurve, 10, this.roadWidth / 2, 8, false);
    const roadMesh = new THREE.Mesh(geometry, this.roadMaterial);
    roadMesh.scale.y = 0.02; // Flatten to ribbon
    roadMesh.receiveShadow = true;
    
    const chunkGroup = new THREE.Group();
    chunkGroup.add(roadMesh);

    // Center Marking
    const markingGeo = new THREE.TubeGeometry(localCurve, 10, 0.15, 8, false);
    const markingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5
    });
    const marking = new THREE.Mesh(markingGeo, markingMat);
    marking.scale.y = 0.03;
    marking.position.y = 0.01;
    chunkGroup.add(marking);

    // Sodium Streetlights
    if (index % 5 === 0) { // Every 5 chunks (100 units)
        const lightPos = localCurve.getPoint(0.5);
        const light = new THREE.PointLight(0xff6a00, 1.5, 80, 2);
        light.position.copy(lightPos).add(new THREE.Vector3(8, 8, 0));
        chunkGroup.add(light);
        
        const pole = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 8, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x050505 })
        );
        pole.position.copy(lightPos).add(new THREE.Vector3(8, 4, 0));
        chunkGroup.add(pole);
    }

    // Removed flat terrain plane to prevent clipping with WorldManager procedural terrain

    this.roadGroup.add(chunkGroup);
    this.chunks.set(index, chunkGroup);
  }

  public isInTunnel() { return false; }
}
