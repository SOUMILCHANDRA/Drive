import * as THREE from 'three';
import { Noise } from '../utils/Noise';

export class RoadManager {
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private roadSegments: Map<number, THREE.Mesh> = new Map();
  private segmentLength: number = 20;
  private roadWidth: number = 8;
  private renderDistance: number = 20; 

  // Building segments based on previous data
  private segmentStarts: Map<number, THREE.Vector3> = new Map();
  private segmentEnds: Map<number, THREE.Vector3> = new Map();

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    // Initial segment data
    this.segmentStarts.set(0, new THREE.Vector3(0, 0, 0));
    this.segmentEnds.set(0, new THREE.Vector3(0, 0, this.segmentLength));
  }

  public getRoadHeight(x: number, z: number): number {
    // For now, straight and flat
    return 0.1;
  }

  public update(playerZ: number) {
    const currentSegmentIndex = Math.floor(playerZ / this.segmentLength);
    const activeSegments = new Set<number>();

    // Load segments in front and slightly behind
    for (let i = -2; i < this.renderDistance; i++) {
      const index = currentSegmentIndex + i;
      if (index < 0) continue;
      activeSegments.add(index);

      if (!this.roadSegments.has(index)) {
        this.generateSegmentData(index);
        this.createSegmentMesh(index);
      }
    }

    // Cleanup
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

    // Ensure previous segment exists
    if (!this.segmentEnds.has(index - 1)) {
        this.generateSegmentData(index - 1);
    }

    const start = this.segmentEnds.get(index - 1)!.clone();
    
    // Step 1: Perfectly straight road
    const direction = new THREE.Vector3(0, 0, 1);
    const end = start.clone().add(direction.multiplyScalar(this.segmentLength));

    this.segmentStarts.set(index, start);
    this.segmentEnds.set(index, end);
  }

  private createSegmentMesh(index: number) {
    const start = this.segmentStarts.get(index)!;
    const end = this.segmentEnds.get(index)!;
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();

    const geometry = new THREE.PlaneGeometry(this.roadWidth, length);
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      roughness: 0.1,
      metalness: 0.5,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.05
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Position center of road
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midPoint);
    
    // Orient road
    mesh.lookAt(end);
    mesh.rotation.x += -Math.PI / 2; // Flatten to ground

    mesh.receiveShadow = true;
    this.roadGroup.add(mesh);
    this.roadSegments.set(index, mesh);

    // Neon sidelines
    this.addSidelines(mesh);
  }

  private addSidelines(parent: THREE.Mesh) {
    const lineGeo = new THREE.BoxGeometry(0.1, this.segmentLength, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    
    const l1 = new THREE.Mesh(lineGeo, lineMat);
    l1.position.set(this.roadWidth / 2, 0.1, 0);
    parent.add(l1);

    const l2 = l1.clone();
    l2.position.set(-this.roadWidth / 2, 0.1, 0);
    parent.add(l2);
  }
}
