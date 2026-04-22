import * as THREE from 'three';
import { Noise } from '../utils/Noise';

export class RoadManager {
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private noise: Noise;
  private roadSegments: Map<number, THREE.Mesh> = new Map();
  private segmentLength: number = 20;
  private roadWidth: number = 8;
  private renderDistance: number = 40; 

  private segmentStarts: Map<number, THREE.Vector3> = new Map();
  private segmentEnds: Map<number, THREE.Vector3> = new Map();
  private segmentDirections: Map<number, THREE.Vector3> = new Map();

  private lastGeneratedIndex: number = -1;

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    // Prepare seeding (will be finalized in first update)
    const start = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(0, 0, 1);
    const end = start.clone().add(dir.clone().multiplyScalar(this.segmentLength));
    
    this.segmentStarts.set(0, start);
    this.segmentDirections.set(0, dir);
    this.segmentEnds.set(0, end);
    this.lastGeneratedIndex = 0;
  }

  public getRoadHeight(_x: number, z: number): number {
    const index = Math.floor(z / this.segmentLength);
    const start = this.segmentStarts.get(index);
    const end = this.segmentEnds.get(index);
    if (!start || !end) return 0;

    // Linear interpolation based on Z
    const t = (z - start.z) / (end.z - start.z);
    return THREE.MathUtils.lerp(start.y, end.y, THREE.MathUtils.clamp(t, 0, 1)) + 0.15;
  }

  public update(playerZ: number, getHeight: (x: number, z: number) => number) {
    const currentSegmentIndex = Math.max(0, Math.floor(playerZ / this.segmentLength));
    
    // Seed the first segment height if not done
    if (this.lastGeneratedIndex === 0 && this.segmentStarts.get(0)!.y === 0) {
        const s0 = this.segmentStarts.get(0)!;
        const e0 = this.segmentEnds.get(0)!;
        s0.y = getHeight(s0.x, s0.z);
        e0.y = getHeight(e0.x, e0.z);
    }

    // Generate upcoming segments forward-chained
    const targetIndex = currentSegmentIndex + this.renderDistance;
    while (this.lastGeneratedIndex < targetIndex) {
        this.generateNextSegment(this.lastGeneratedIndex + 1, getHeight);
    }

    const activeSegments = new Set<number>();
    for (let i = -5; i < this.renderDistance; i++) {
        const index = currentSegmentIndex + i;
        if (index < 0) continue;
        activeSegments.add(index);
        if (!this.roadSegments.has(index)) {
            this.createSegmentMesh(index);
        }
    }

    // Cleanup
    for (const [index, mesh] of this.roadSegments.entries()) {
      if (!activeSegments.has(index)) {
        this.roadGroup.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) mesh.material.dispose();
        this.roadSegments.delete(index);
      }
    }
  }

  private generateNextSegment(index: number, getHeight: (x: number, z: number) => number) {
    const prevEnd = this.segmentEnds.get(index - 1)!.clone();
    const prevDir = this.segmentDirections.get(index - 1)!.clone();

    // 1. Horizontal direction rotation
    const angleNoise = this.noise.get(index * 10, 0, 1, 0.5, 1);
    const angle = (angleNoise - 0.5) * 0.4;
    const horizontalDir = new THREE.Vector3(prevDir.x, 0, prevDir.z).normalize();
    const nextDir = horizontalDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    
    // 2. Exact chaining of points
    const start = prevEnd.clone(); // MUST touch previous end
    const nextPos2D = start.clone().add(nextDir.multiplyScalar(this.segmentLength));
    const end = nextPos2D.clone();
    end.y = getHeight(end.x, end.z);

    // 3. Normalized actual direction
    const finalDir = new THREE.Vector3().subVectors(end, start).normalize();

    this.segmentStarts.set(index, start);
    this.segmentDirections.set(index, finalDir);
    this.segmentEnds.set(index, end);
    this.lastGeneratedIndex = index;
  }

  private createSegmentMesh(index: number) {
    const start = this.segmentStarts.get(index)!;
    const end = this.segmentEnds.get(index)!;
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();

    const geometry = new THREE.PlaneGeometry(this.roadWidth, length);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x111111,
      roughness: 0.2,
      metalness: 0.8,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.1
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5));
    
    // CORRECT LOCAL ALIGNMENT
    mesh.lookAt(end);
    mesh.rotateX(-Math.PI / 2);

    mesh.receiveShadow = true;
    this.roadGroup.add(mesh);
    this.roadSegments.set(index, mesh);

    this.addSidelines(mesh, length);
    this.addDebugPoint(start);
  }

  private addSidelines(parent: THREE.Mesh, length: number) {
    const lineGeo = new THREE.BoxGeometry(0.15, length, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    
    const l1 = new THREE.Mesh(lineGeo, lineMat);
    l1.position.set(this.roadWidth / 2, 0.05, 0); 
    parent.add(l1);

    const l2 = l1.clone();
    l2.position.set(-this.roadWidth / 2, 0.05, 0);
    parent.add(l2);
  }

  private addDebugPoint(pos: THREE.Vector3) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.3),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    sphere.position.copy(pos);
    this.roadGroup.add(sphere);
  }
}
