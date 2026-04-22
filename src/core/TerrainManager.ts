import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { CONFIG } from '../config';
import { RoadManager } from './RoadManager';

/**
 * Manages the infinite 5x5 terrain grid (The "Slow Roads" Treadmill).
 * Implements nested LOD chunks and road-terrain stitching.
 */
export class TerrainManager {
  private scene: THREE.Object3D;
  private noise: Noise;
  private roadManager: RoadManager;
  private chunks: Map<string, THREE.Mesh> = new Map();
  private chunkSize: number = 500; // 500m chunks for 5x5 (2.5km total span)
  private resolution: number = 32; // Resolution per chunk
  private terrainMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Object3D, noise: Noise, roadManager: RoadManager) {
    this.scene = scene;
    this.noise = noise;
    this.roadManager = roadManager;

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x050508,
      metalness: 0.4,
      roughness: 0.8,
      flatShading: true // Cinematic faceted look for mountains
    });
  }

  /**
   * Updates the terrain grid based on player position.
   * Teleports chunks to stay centered around the player.
   */
  public update(playerPos: THREE.Vector3) {
    const playerGridX = Math.floor(playerPos.x / this.chunkSize);
    const playerGridZ = Math.floor(playerPos.z / this.chunkSize);

    const range = 2; // 5x5 grid

    for (let x = -range; x <= range; x++) {
      for (let z = -range; z <= range; z++) {
        const gx = playerGridX + x;
        const gz = playerGridZ + z;
        const key = `${gx},${gz}`;

        if (!this.chunks.has(key)) {
          this.createChunk(gx, gz);
        }
      }
    }

    // Cleanup distant chunks
    for (const [key, chunk] of this.chunks.entries()) {
      const [gx, gz] = key.split(',').map(Number);
      if (Math.abs(gx - playerGridX) > range + 1 || Math.abs(gz - playerGridZ) > range + 1) {
        this.scene.remove(chunk);
        chunk.geometry.dispose();
        this.chunks.delete(key);
      }
    }
  }

  private createChunk(gx: number, gz: number) {
    const geometry = new THREE.PlaneGeometry(this.chunkSize, this.chunkSize, this.resolution, this.resolution);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position.array as Float32Array;
    const planet = CONFIG.PLANETS.EARTH;
    const centerX = gx * this.chunkSize;
    const centerZ = gz * this.chunkSize;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] + centerX;
      const z = positions[i + 2] + centerZ;

      // 1. BASE NOISE (Massive Mountain Ridges)
      let h = this.noise.fbm(x, z, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;

      // 2. ROAD STITCHING (Slow Roads Blueprint)
      const roadX = this.roadManager.getRoadX(z);
      const roadY = this.roadManager.getRoadHeight(roadX, z);
      const distToRoad = Math.abs(x - roadX);
      
      const stitchRange = 40; // 40m blend zone
      if (distToRoad < stitchRange) {
        const t = Math.pow(distToRoad / stitchRange, 2); // Quadratic blend for 'carved' look
        h = THREE.MathUtils.lerp(roadY - 0.2, h, t); // Slight offset to keep road clear
      }

      positions[i + 1] = h;
    }

    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, this.terrainMaterial);
    mesh.position.set(centerX, 0, centerZ);
    mesh.receiveShadow = true;
    
    this.scene.add(mesh);
    this.chunks.set(`${gx},${gz}`, mesh);
  }
}
