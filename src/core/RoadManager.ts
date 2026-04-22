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

  // Continuity maps
  private segmentStarts: Map<number, THREE.Vector3> = new Map();
  private segmentEnds: Map<number, THREE.Vector3> = new Map();
  private segmentDirections: Map<number, THREE.Vector3> = new Map();

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise; // Explicit assignment
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    // Initial segment (Segment 0)
    const start = new THREE.Vector3(0, 0, 0);
    const dir = new THREE.Vector3(0, 0, 1);
    const end = start.clone().add(dir.clone().multiplyScalar(this.segmentLength));
    
    this.segmentStarts.set(0, start);
    this.segmentDirections.set(0, dir);
    this.segmentEnds.set(0, end);
  }

  public getRoadHeight(_x: number, z: number): number {
    const index = Math.floor(z / this.segmentLength);
    const start = this.segmentStarts.get(index);
    const end = this.segmentEnds.get(index);
    
    if (!start || !end) return 0;

    // Correct Interpolation
    const t = (z - start.z) / (end.z - start.z);
    return THREE.MathUtils.lerp(start.y, end.y, THREE.MathUtils.clamp(t, 0, 1)) + 0.1;
  }

  public update(playerZ: number, getHeight: (x: number, z: number) => number) {
    const currentSegmentIndex = Math.floor(playerZ / this.segmentLength);
    const activeSegments = new Set<number>();

    // Start from -5 to ensure road behind is visible
    for (let i = -5; i < this.renderDistance; i++) {
        const index = currentSegmentIndex + i;
        if (index < 0) continue;
        activeSegments.add(index);
  
        if (!this.roadSegments.has(index)) {
          this.generateSegmentData(index, getHeight);
          this.createSegmentMesh(index);
        }
    }

    // Dispose old segments
    for (const [index, mesh] of this.roadSegments.entries()) {
      if (!activeSegments.has(index)) {
        this.roadGroup.remove(mesh);
        mesh.geometry.dispose();
        if (mesh.material instanceof THREE.Material) mesh.material.dispose();
        this.roadSegments.delete(index);
      }
    }
  }

  private generateSegmentData(index: number, getHeight: (x: number, z: number) => number) {
    if (this.segmentStarts.has(index)) return;

    // Always build from previous
    if (!this.segmentEnds.has(index - 1)) {
        this.generateSegmentData(index - 1, getHeight);
    }

    const prevEnd = this.segmentEnds.get(index - 1)!.clone();
    const prevDir = this.segmentDirections.get(index - 1)!.clone();
    
    // Step 2: Curves (Rotate DIRECTION vector)
    const angleNoise = this.noise.get(index * 10, 0, 1, 0.5, 1);
    const angle = (angleNoise - 0.5) * 0.4;
    
    const newDir = prevDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    
    // Step 3: Elevation (Match terrain)
    const nextPos2D = prevEnd.clone().add(newDir.clone().multiplyScalar(this.segmentLength));
    const startY = getHeight(prevEnd.x, prevEnd.z);
    const endY = getHeight(nextPos2D.x, nextPos2D.z);
    
    prevEnd.y = startY;
    const newEnd = nextPos2D.clone();
    newEnd.y = endY;

    // Recalculate normalized direction to handle the Y slope
    const finalDir = new THREE.Vector3().subVectors(newEnd, prevEnd).normalize();

    this.segmentStarts.set(index, prevEnd);
    this.segmentDirections.set(index, finalDir);
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
    
    // A. Position in middle
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    mesh.position.copy(midPoint);
    
    // B. Look at end
    mesh.lookAt(end);
    
    // C. Flatten (IMPORTANT)
    mesh.rotateX(-Math.PI / 2);

    mesh.receiveShadow = true;
    this.roadGroup.add(mesh);
    this.roadSegments.set(index, mesh);

    this.addSidelines(mesh);
    this.addDebugSphere(start);
  }

  private addSidelines(parent: THREE.Mesh) {
    // Height of box is the length of road segment
    const lineGeo = new THREE.BoxGeometry(0.1, this.segmentLength, 0.1);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f3ff });
    
    const l1 = new THREE.Mesh(lineGeo, lineMat);
    l1.position.set(this.roadWidth / 2, 0.02, 0); 
    parent.add(l1);

    const l2 = l1.clone();
    l2.position.set(-this.roadWidth / 2, 0.02, 0);
    parent.add(l2);
  }

  private addDebugSphere(pos: THREE.Vector3) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.4),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    sphere.position.copy(pos);
    this.roadGroup.add(sphere);
  }
}
