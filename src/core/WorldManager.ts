import * as THREE from 'three';
import { Chunk } from '../entities/Chunk';
import { Noise } from '../utils/Noise';
import { BiomeManager } from './BiomeManager';
import { CityGenerator } from './CityGenerator';
import { StructureLibrary } from '../entities/StructureLibrary';

export class WorldManager {
  private chunks: Map<string, Chunk> = new Map();
  private chunkSize: number = 200;
  private renderDistance: number = 3;
  private noise: Noise;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.noise = new Noise(Math.random());
  }

  public getNoise(): Noise {
    return this.noise;
  }

  public update(playerPosition: THREE.Vector3, getRoadX?: (z: number) => number) {
    const pX = Math.floor(playerPosition.x / this.chunkSize);
    const pZ = Math.floor(playerPosition.z / this.chunkSize);

    const activeCoords = new Set<string>();

    for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
      for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
        const cX = (pX + x) * this.chunkSize;
        const cZ = (pZ + z) * this.chunkSize;
        const key = `${cX},${cZ}`;
        activeCoords.add(key);

        if (!this.chunks.has(key)) {
          const chunk = new Chunk(cX, cZ, this.chunkSize, this.noise, getRoadX);
          this.chunks.set(key, chunk);
          this.scene.add(chunk.mesh);

          // FIX: override chunk terrain material after creation
          // Chunk.ts may be setting random/bright colors — force it dark here
          chunk.mesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              // Only override if it looks like terrain (not a road marking or structure)
              const mat = mesh.material as THREE.MeshStandardMaterial;
              if (mat && mat.isMeshStandardMaterial) {
                const col = mat.color;
                // If the material is brighter than expected for night terrain, darken it
                const brightness = col.r + col.g + col.b;
                if (brightness > 1.0) {
                  // This is a suspiciously bright material — it's causing your colored blocks
                  mat.color.set(0x1a2030);
                  mat.roughness = 0.95;
                  mat.metalness = 0.0;
                  mat.emissive.set(0x000000);
                  mat.emissiveIntensity = 0;
                }
              }
            }
          });

          if (BiomeManager.getBiome(cZ) === 'LOWLANDS' && getRoadX) {
            CityGenerator.spawnCityRow(chunk.mesh as any, cZ - this.chunkSize / 2, cZ + this.chunkSize / 2, getRoadX);
          }

          if (Math.random() > 0.98 && getRoadX) {
            const roadX = getRoadX(cZ);
            const gas = StructureLibrary.createGasStation();
            gas.position.set(roadX + 25, 0, cZ);
            gas.rotation.y = Math.PI / 2;
            this.scene.add(gas);
          }
        }
      }
    }

    for (const [key, chunk] of this.chunks.entries()) {
      if (!activeCoords.has(key)) {
        this.scene.remove(chunk.mesh);
        chunk.dispose();
        this.chunks.delete(key);
      }
    }
  }

  public getHeight(x: number, z: number): number {
    return this.noise.get(x, z, 4, 0.5, 0.005) * 50;
  }
}
