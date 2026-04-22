import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { PropManager } from './PropManager';
import { createRoadMaterial } from '../utils/RoadMaterial';

export class RoadManager {
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private noise: Noise;
  
  private points: THREE.Vector3[] = [];
  private tunnelChunks: Set<number> = new Set();
  private chunks: Map<number, THREE.Mesh> = new Map();
  private chunkSize: number = 100; // units
  private roadWidth: number = 10;
  private renderDistance: number = 5; // chunks
  
  private spline: THREE.CatmullRomCurve3 | null = null;
  private propManager: PropManager;
  private roadOffset: number = 0;

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);
    this.propManager = new PropManager(this.scene);

    // Initial points
    this.points.push(new THREE.Vector3(0, 0, -20));
    this.points.push(new THREE.Vector3(0, 0, 0));
    this.points.push(new THREE.Vector3(0, 0, 50));
    
    this.generateMorePoints(10);
    this.updateSpline();
  }

  private generateMorePoints(count: number) {
    let lastPoint = this.points[this.points.length - 1];
    let lastDir = new THREE.Vector3().subVectors(lastPoint, this.points[this.points.length - 2]).normalize();

    for (let i = 0; i < count; i++) {
      const index = this.points.length;
      const angleNoise = this.noise.get(index * 10, 0, 1, 0.5, 1);
      const angle = (angleNoise - 0.5) * 0.8;
      
      const pitchNoise = this.noise.get(0, index * 10, 1, 0.5, 1);
      const pitch = (pitchNoise - 0.5) * 0.4;

      const newDir = lastDir.clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
        .applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
        .normalize();

      const newPoint = lastPoint.clone().add(newDir.multiplyScalar(50));
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
    const t = THREE.MathUtils.clamp((z + 20) / (this.points.length * 50), 0, 1);
    const p = this.spline.getPointAt(t);
    return p.y;
  }

  public getPoints() {
    return this.points;
  }

  public getRoadData(z: number): { position: THREE.Vector3, tangent: THREE.Vector3 } {
    if (!this.spline) return { position: new THREE.Vector3(0, 0, z), tangent: new THREE.Vector3(0, 0, 1) };
    
    // Find approximately where we are on the spline based on Z
    // This is an approximation for an infinite spline
    // For now, let's use a very simple lookup
    const t = THREE.MathUtils.clamp((z + 20) / (this.points.length * 50), 0, 1);
    return {
      position: this.spline.getPointAt(t),
      tangent: this.spline.getTangentAt(t)
    };
  }

  public update(playerZ: number, speed: number) {
    this.roadOffset += speed * 0.01;
    const currentChunkIndex = Math.floor(playerZ / this.chunkSize);
    
    // Update shader offsets
    this.chunks.forEach((mesh) => {
        if (mesh.material instanceof THREE.ShaderMaterial) {
            mesh.material.uniforms.uOffset.value = this.roadOffset;
        }
    });
    
    // Generate new chunks
    for (let i = 0; i < this.renderDistance; i++) {
        const index = currentChunkIndex + i;
        if (index < 0) continue;
        if (!this.chunks.has(index)) {
            this.createChunkMesh(index);
        }
    }

    // Cleanup old chunks
    for (const [index, mesh] of this.chunks.entries()) {
      if (index < currentChunkIndex - 2 || index > currentChunkIndex + this.renderDistance) {
        this.roadGroup.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) mesh.material.dispose();
        this.chunks.delete(index);
      }
    }

    // Generate more points if needed
    if (playerZ > (this.points.length - 10) * 50) {
        this.generateMorePoints(10);
        this.updateSpline();
    }
  }

  private createChunkMesh(index: number) {
    const isTunnel = index % 10 === 0 && index !== 0; // Every 1km (10 chunks)
    if (isTunnel) this.tunnelChunks.add(index);

    const startT = (index * this.chunkSize) / (this.points.length * 50);
    const endT = ((index + 1) * this.chunkSize) / (this.points.length * 50);
    
    const segmentPoints: THREE.Vector3[] = [];
    const div = 15;
    for (let i = 0; i <= div; i++) {
        segmentPoints.push(this.spline!.getPointAt(startT + (endT - startT) * (i / div)));
    }

    const curve = new THREE.CatmullRomCurve3(segmentPoints);
    
    let geometry: THREE.BufferGeometry;
    let material: THREE.Material;

    if (isTunnel) {
        // Hexagonal Tube
        geometry = new THREE.TubeGeometry(curve, 20, this.roadWidth * 1.5, 6, false);
        material = new THREE.MeshStandardMaterial({
          color: 0x050505,
          side: THREE.BackSide,
          emissive: 0x00f3ff,
          emissiveIntensity: 0.3,
          wireframe: true
        });
    } else {
        // Flat Ribbon Road
        geometry = new THREE.TubeGeometry(curve, 10, this.roadWidth / 2, 2, false);
        material = createRoadMaterial();
    }

    const mesh = new THREE.Mesh(geometry, material);
    if (!isTunnel) mesh.scale.y = 0.1; // Flatten into a ribbon
    mesh.receiveShadow = true;
    this.roadGroup.add(mesh);
    this.chunks.set(index, mesh);

    // Spawn Ring in middle of chunk (rarely)
    if (index % 3 === 0 && !isTunnel) {
        const midT = (startT + endT) / 2;
        const pos = this.spline!.getPointAt(midT);
        const tan = this.spline!.getTangentAt(midT);
        this.propManager.spawnRing(pos.add(new THREE.Vector3(0, 2, 0)), tan);
    }
  }

  public updateProps(carPos: THREE.Vector3, onCollect: () => void) {
    this.propManager.update(carPos, onCollect);
  }

  public isInTunnel(z: number): boolean {
    const chunkIndex = Math.floor(z / this.chunkSize);
    return this.tunnelChunks.has(chunkIndex);
  }
}
