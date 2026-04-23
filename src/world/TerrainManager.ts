import * as THREE from 'three';
import { getWorldX, getWorldHeight } from './Road';

export class TerrainManager {
  private scene: THREE.Scene;
  private groundMesh: THREE.Mesh;
  private terrainMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x020205,
      roughness: 0.9,
      metalness: 0.1,
    });

    const geometry = new THREE.PlaneGeometry(500, 1500, 50, 100);
    this.groundMesh = new THREE.Mesh(geometry, this.terrainMaterial);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.scene.add(this.groundMesh);
  }

  public update(totalDistance: number): void {
    const pos = this.groundMesh.geometry.attributes.position;
    const segmentsX = 50;
    const columns = segmentsX + 1;
    const width = 500;
    for (let i = 0; i < pos.count; i++) {
        const xIndex = i % columns;
        const originalX = (xIndex / segmentsX) * width - width / 2;
        const zLocal = pos.getY(i);
        const worldZ = zLocal + 400 + totalDistance;
        const xCurve = getWorldX(worldZ);
        const yWorld = getWorldHeight(originalX + xCurve, worldZ);
        pos.setX(i, originalX + xCurve);
        pos.setZ(i, yWorld - 0.2);
    }
    pos.needsUpdate = true;
    this.groundMesh.geometry.computeVertexNormals();
  }
}
