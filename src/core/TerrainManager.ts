import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { getWorldX } from './RoadManager';

/**
 * TerrainManager: Now follows the winding road path.
 */
export class TerrainManager {
  private scene: THREE.Scene;
  private leftTerrain!: THREE.Mesh;
  private rightTerrain!: THREE.Mesh;
  private noise2D = createNoise2D();
  private terrainMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x020302,
      roughness: 1.0,
      metalness: 0.0,
    });
    this.createTerrain();
  }

  private createTerrain(): void {
    // High-res geometry for smoother winding
    const geometry = new THREE.PlaneGeometry(120, 1000, 40, 100);
    this.leftTerrain = new THREE.Mesh(geometry, this.terrainMaterial);
    this.rightTerrain = new THREE.Mesh(geometry.clone(), this.terrainMaterial);

    this.leftTerrain.rotation.x = -Math.PI / 2;
    this.rightTerrain.rotation.x = -Math.PI / 2;
    
    this.scene.add(this.leftTerrain, this.rightTerrain);
  }

  public update(totalDistance: number): void {
    this.updateMesh(this.leftTerrain, totalDistance, -66);
    this.updateMesh(this.rightTerrain, totalDistance, 66);
  }

  private updateMesh(mesh: THREE.Mesh, totalDistance: number, xBase: number): void {
    const pos = mesh.geometry.attributes.position;
    const segmentsX = 40;
    const columns = segmentsX + 1;
    const width = 120;
    
    for (let i = 0; i < pos.count; i++) {
        const xIndex = i % columns;
        const originalX = (xIndex / segmentsX) * width - width / 2;
        
        const zLocal = pos.getY(i);
        const worldZ = zLocal + 400 + totalDistance;
        
        const xCurve = getWorldX(worldZ);
        const h = this.noise2D((originalX + xBase) * 0.02, worldZ * 0.01) * 4;
        
        pos.setX(i, originalX + xCurve + xBase);
        pos.setZ(i, h - 5); // Slightly lower to avoid road clipping
    }
    pos.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
  }
}
