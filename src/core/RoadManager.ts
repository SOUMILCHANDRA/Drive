import * as THREE from 'three';
import { Noise } from '../utils/Noise';

export class RoadManager {
  private noise: Noise;
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private roadSegments: Map<number, THREE.Mesh> = new Map();
  private segmentLength: number = 20;
  private roadWidth: number = 8;
  private renderDistance: number = 50; // In segments

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);
  }

  public getRoadCenter(z: number): THREE.Vector3 {
    // Smooth curves based on noise
    const x = this.noise.get(0, z, 2, 0.5, 0.002) * 200;
    const y = this.noise.get(x, z, 4, 0.5, 0.005) * 50 + 0.1; // Slightly above terrain
    return new THREE.Vector3(x, y, z);
  }

  public update(playerZ: number) {
    const currentSegment = Math.floor(playerZ / this.segmentLength);

    const activeSegments = new Set<number>();
    
    for (let i = -10; i < this.renderDistance; i++) {
      const segIndex = currentSegment + i;
      activeSegments.add(segIndex);

      if (!this.roadSegments.has(segIndex)) {
        this.createSegment(segIndex);
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

  private createSegment(index: number) {
    const zStart = index * this.segmentLength;
    const zEnd = (index + 1) * this.segmentLength;

    const p1 = this.getRoadCenter(zStart);
    const p2 = this.getRoadCenter(zEnd);

    // Create a ribbon between p1 and p2
    const geometry = new THREE.PlaneGeometry(this.roadWidth, this.segmentLength, 1, 1);
    
    // Position and rotate the segment
    // More complex: create a custom BufferGeometry or use a path
    // For now, let's use a simple mesh and align it
    const material = new THREE.MeshStandardMaterial({ 
      color: 0x222222,
      roughness: 0.1,
      metalness: 0.5,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.05
    });

    const mesh = new THREE.Mesh(geometry, material);
    
    // Align mesh to p1 and p2
    const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    mesh.position.copy(midPoint);
    mesh.lookAt(p2);
    mesh.rotation.x += Math.PI / 2;

    mesh.receiveShadow = true;
    this.roadGroup.add(mesh);
    this.roadSegments.set(index, mesh);

    // Add neon lines on the sides
    const lineGeo = new THREE.BoxGeometry(0.1, this.segmentLength, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    
    const l1 = new THREE.Mesh(lineGeo, lineMat);
    l1.position.set(this.roadWidth / 2, 0.1, 0);
    mesh.add(l1);

    const l2 = l1.clone();
    l2.position.set(-this.roadWidth / 2, 0.1, 0);
    mesh.add(l2);
  }
}
