import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { BiomeManager } from '../core/BiomeManager';

export class Chunk {
  public mesh: THREE.Group;
  public terrain: THREE.Mesh;
  public size: number;
  public x: number;
  public z: number;

  constructor(x: number, z: number, size: number, noise: Noise, getRoadX?: (z: number) => number) {
    this.x = x;
    this.z = z;
    this.size = size;
    this.mesh = new THREE.Group();

    const segments = 40;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);
    for (let i = 0; i < vertices.length; i += 3) {
      const vx = vertices[i] + x + size / 2;
      const vz = vertices[i + 2] + z - size / 2;
      
      const params = BiomeManager.getParams(vz);
      const noiseH = noise.get(vx, vz, 4, 0.5, 0.005) * params.ELEVATION_SCALE;
      
      const roadX = getRoadX ? getRoadX(vz) : 0;
      const distToRoad = Math.abs(vx - roadX);
      const roadWidth = 14;
      const carveRadius = 30;
      
      const carveFactor = 1.0 - Math.min(Math.max((distToRoad - roadWidth / 2) / carveRadius, 0), 1);
      const h = THREE.MathUtils.lerp(noiseH, noise.get(roadX, vz, 4, 0.5, 0.005) * params.ELEVATION_SCALE, carveFactor);

      vertices[i + 1] = h;

      // FIX: Deep Nocturnal Palette (No bright colors)
      const color = new THREE.Color();
      if (carveFactor > 0.8) {
        color.setRGB(0.02, 0.02, 0.03); // Deep black asphalt
      } else if (h > 45) {
        color.setRGB(0.15, 0.15, 0.2); // Faint mountain rim
      } else {
        color.setRGB(0.05, 0.06, 0.08); // Dark midnight terrain
      }
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });

    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.mesh.add(this.terrain);
    
    this.mesh.position.set(x + size / 2, 0, z - size / 2);
  }

  public dispose() {
    this.terrain.geometry.dispose();
    (this.terrain.material as THREE.Material).dispose();
  }
}
