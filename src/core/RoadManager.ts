import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { CONFIG } from '../config';

export class RoadManager {
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private noise: Noise;
  
  private points: THREE.Vector3[] = [];
  private chunks: Map<number, THREE.Group> = new Map();
  private chunkSize: number = CONFIG.ROAD.CHUNK_SIZE;
  private roadWidth: number = CONFIG.ROAD.WIDTH;
  private renderDistance: number = CONFIG.ROAD.RENDER_DISTANCE;
  
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

    this.points.push(new THREE.Vector3(0, 0, -100));
    this.points.push(new THREE.Vector3(0, 0, 0));
    this.points.push(new THREE.Vector3(0, 0, 100));
    
    this.generateMorePoints(10);
    this.updateSpline();
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
        this.points.push(newPoint);
        lastPoint = newPoint;
        lastDir = newDir;
    }
  }

  private updateSpline() {
    this.spline = new THREE.CatmullRomCurve3(this.points);
  }

  public getRoadHeight(_x: number, z: number): number {
    if (!this.spline) return 0;
    const t = THREE.MathUtils.clamp((z + 100) / (this.points.length * this.chunkSize), 0, 1);
    return this.spline.getPointAt(t).y;
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
    const startT = (index * this.chunkSize) / (this.points.length * this.chunkSize);
    const endT = ((index + 1) * this.chunkSize) / (this.points.length * this.chunkSize);
    
    const segmentPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
        segmentPoints.push(this.spline!.getPointAt(THREE.MathUtils.clamp(startT + (endT - startT) * (i / 20), 0, 1)));
    }

    const curve = new THREE.CatmullRomCurve3(segmentPoints);
    const geometry = new THREE.TubeGeometry(curve, 20, this.roadWidth / 2, 8, false);
    const roadMesh = new THREE.Mesh(geometry, this.roadMaterial);
    roadMesh.scale.y = 0.02; // Flatten to ribbon
    roadMesh.receiveShadow = true;
    
    const chunkGroup = new THREE.Group();
    chunkGroup.add(roadMesh);

    // Center Marking
    const markingGeo = new THREE.TubeGeometry(curve, 20, 0.15, 8, false);
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
    if (index % 1 === 0) {
        const lightPos = this.spline!.getPointAt(THREE.MathUtils.clamp(startT + (endT - startT) * 0.5, 0, 1));
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

    // Terrain Background
    const terrainGeo = new THREE.PlaneGeometry(1000, this.chunkSize, 2, 2);
    const terrain = new THREE.Mesh(terrainGeo, this.terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.copy(this.spline!.getPointAt(THREE.MathUtils.clamp(startT + (endT - startT) * 0.5, 0, 1)));
    terrain.position.y -= 0.1;
    chunkGroup.add(terrain);

    this.roadGroup.add(chunkGroup);
    this.chunks.set(index, chunkGroup);
  }

  public isInTunnel() { return false; }
}
