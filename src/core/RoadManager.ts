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

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    // Initial segment data
    const start = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(0, 0, 1);
    const end = start.clone().add(dir.clone().multiplyScalar(this.segmentLength));
    
    this.segmentStarts.set(0, start);
    this.segmentDirections.set(0, dir);
    this.segmentEnds.set(0, end);
  }

  public getRoadHeight(_x: number, _z: number): number {
    // Stage 2: Curves added, keeping flat for now
    return 0;
  }

  public update(playerZ: number) {
    const currentSegmentIndex = Math.floor(playerZ / this.segmentLength);
    const activeSegments = new Set<number>();

    for (let i = -5; i < this.renderDistance; i++) {
        const index = currentSegmentIndex + i;
        if (index < 0) continue;
        activeSegments.add(index);
  
        if (!this.roadSegments.has(index)) {
          this.generateSegmentData(index);
          this.createSegmentMesh(index);
        }
    }

    for (const [index, mesh] of this.roadSegments.entries()) {
      if (!activeSegments.has(index)) {
        this.roadGroup.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        this.roadSegments.delete(index);
      }
    }
  }

  private generateSegmentData(index: number) {
    if (this.segmentStarts.has(index)) return;

    if (!this.segmentEnds.has(index - 1)) {
        this.generateSegmentData(index - 1);
    }

    const prevEnd = this.segmentEnds.get(index - 1)!.clone();
    const prevDir = this.segmentDirections.get(index - 1)!.clone();
    
    // Step 2: Add slight curves by rotating the DIRECTION vector
    // Using deterministic noise for the angle
    const angleNoise = this.noise.get(index * 10, 0, 1, 0.5, 1);
    const angle = (angleNoise - 0.5) * 0.4;
    
    // Rotate direction vector around Y axis (not the mesh)
    const newDir = prevDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    const newEnd = prevEnd.clone().add(newDir.clone().multiplyScalar(this.segmentLength));

    // Force flat for this stage
    newEnd.y = 0;

    this.segmentStarts.set(index, prevEnd);
    this.segmentDirections.set(index, newDir);
    this.segmentEnds.set(index, newEnd);
  }

  private createSegmentMesh(index: number) {
    const start = this.segmentStarts.get(index)!;
    const end = this.segmentEnds.get(index)!;
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();

    const geometry = new THREE.PlaneGeometry(this.roadWidth, length);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      roughness: 0.1,
      metalness: 0.5,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.05
    });

    const mesh = new THREE.Mesh(geometry, material);
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midPoint);
    
    // THE FIX
    mesh.lookAt(end);
    mesh.rotateX(-Math.PI / 2);

    mesh.receiveShadow = true;
    this.roadGroup.add(mesh);
    this.roadSegments.set(index, mesh);

    this.addSidelines(mesh);
    this.addDebugSphere(start);
  }

  private addSidelines(parent: THREE.Mesh) {
    const lineGeo = new THREE.BoxGeometry(0.1, this.segmentLength, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    
    const l1 = new THREE.Mesh(lineGeo, lineMat);
    l1.position.set(this.roadWidth / 2, 0.01, 0);
    parent.add(l1);

    const l2 = l1.clone();
    l2.position.set(-this.roadWidth / 2, 0.01, 0);
    parent.add(l2);
  }

  private addDebugSphere(pos: THREE.Vector3) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.5),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    sphere.position.copy(pos);
    this.roadGroup.add(sphere);
  }
}
