import * as THREE from 'three';
import { Noise } from '../utils/Noise';

export class RoadManager {
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private roadSegments: Map<number, THREE.Mesh> = new Map();
  private segmentLength: number = 20;
  private roadWidth: number = 8;
  private renderDistance: number = 40; 

  private segmentStarts: Map<number, THREE.Vector3> = new Map();
  private segmentEnds: Map<number, THREE.Vector3> = new Map();
  private segmentDirections: Map<number, THREE.Vector3> = new Map();

  constructor(scene: THREE.Scene, _noise: Noise) {
    this.scene = scene;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    // Initial segment data
    // Start at origin, heading straight forward (Z+)
    const start = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(0, 0, 1);
    const end = start.clone().add(dir.clone().multiplyScalar(this.segmentLength));
    
    this.segmentStarts.set(0, start);
    this.segmentDirections.set(0, dir);
    this.segmentEnds.set(0, end);
  }

  public getRoadHeight(_x: number, _z: number): number {
    // Stage 1: Perfectly flat road to ensure core geometry works
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

    // Recursive check for previous data
    if (!this.segmentEnds.has(index - 1)) {
        this.generateSegmentData(index - 1);
    }

    const prevEnd = this.segmentEnds.get(index - 1)!.clone();
    const prevDir = this.segmentDirections.get(index - 1)!.clone();
    
    // Step 1: Perfectly straight road (no rotation yet)
    const newDir = prevDir.clone();
    const newEnd = prevEnd.clone().add(newDir.clone().multiplyScalar(this.segmentLength));

    // Force Y to 0 for Step 1
    prevEnd.y = 0;
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

    // PlaneGeometry(width, height) - here height is the length of road
    const geometry = new THREE.PlaneGeometry(this.roadWidth, length);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      roughness: 0.1,
      metalness: 0.5,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.05
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Position in the exact middle of start and end
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midPoint);
    
    // ALIGNMENT FIX
    mesh.lookAt(end); // Point 'front' towards the end point
    mesh.rotateX(-Math.PI / 2); // Flatten it so it lies on the XZ plane

    mesh.receiveShadow = true;
    this.roadGroup.add(mesh);
    this.roadSegments.set(index, mesh);

    this.addSidelines(mesh);
  }

  private addSidelines(parent: THREE.Mesh) {
    const lineGeo = new THREE.BoxGeometry(0.1, this.segmentLength, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    
    const l1 = new THREE.Mesh(lineGeo, lineMat);
    l1.position.set(this.roadWidth / 2, 0.01, 0); // Tiny offset to prevent Z-fighting
    parent.add(l1);

    const l2 = l1.clone();
    l2.position.set(-this.roadWidth / 2, 0.01, 0);
    parent.add(l2);
  }
}
