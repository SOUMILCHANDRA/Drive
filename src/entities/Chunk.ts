import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { BiomeManager } from '../core/BiomeManager';

export class Chunk {
  public mesh: THREE.Mesh;
  public size: number;
  public x: number;
  public z: number;

  constructor(x: number, z: number, size: number, noise: Noise, getRoadX?: (z: number) => number) {
    this.x = x;
    this.z = z;
    this.size = size;

    const segments = 32;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    
    // Deform vertices based on noise and set colors
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);
    for (let i = 0; i < vertices.length; i += 3) {
      const vx = vertices[i] + x + size / 2;
      const vz = -vertices[i + 1] + z - size / 2;
      
      const params = BiomeManager.getParams(vz);
      const noiseH = noise.get(vx, vz, 4, 0.5, 0.005) * params.ELEVATION_SCALE;
      
      // Road Carving Logic
      const roadX = getRoadX ? getRoadX(vz) : 0;
      const distToRoad = Math.abs(vx - roadX);
      const roadWidth = 12; // Matches CONFIG.ROAD.WIDTH
      const carveRadius = 25;
      
      // Smoothly flatten terrain near road
      const carveFactor = 1.0 - Math.min(Math.max((distToRoad - roadWidth / 2) / carveRadius, 0), 1);
      const h = THREE.MathUtils.lerp(noiseH, noise.get(roadX, vz, 4, 0.5, 0.005) * params.ELEVATION_SCALE, carveFactor);

      vertices[i + 2] = h;

      // Color mapping
      const color = new THREE.Color();
      if (carveFactor > 0.8) {
        color.setHSL(0.6, 0.2, 0.1); // Road shoulder (darker)
      } else if (h > 35) {
        color.setHSL(0.8, 1, 0.2); // Mountains
      } else if (h > 15) {
        color.setHSL(0.5, 0.8, 0.1); 
      } else {
        color.setHSL(0.9, 0.5, 0.05); // Lowlands
      }
      colors[i] = color.r;
      colors[i + 1] = color.g;
      colors[i + 2] = color.b;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      metalness: 0.2,
      flatShading: true,
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.set(x + size / 2, 0, z - size / 2); // Center it
    this.mesh.receiveShadow = true;
  }

  public dispose() {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
