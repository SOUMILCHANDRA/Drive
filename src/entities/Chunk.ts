import * as THREE from 'three';
import { CONFIG } from '../config';
import { Noise } from '../utils/Noise';

export class Chunk {
  public mesh: THREE.Group;
  public terrain: THREE.Mesh;
  public size: number;
  public x: number;
  public z: number;

  constructor(x: number, z: number, size: number, noise: Noise, getRoadX?: (z: number) => number, getRoadHeight?: (x: number, z: number) => number) {
    this.x = x;
    this.z = z;
    this.size = size;
    this.mesh = new THREE.Group();

    const segments = 32;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    for (let i = 0; i < vertices.length; i += 3) {
      const vx = vertices[i] + x + size / 2;
      const vz = vertices[i + 2] + z - size / 2;
      
      const planet = CONFIG.PLANETS.EARTH; 
      const noiseH = noise.fbm(vx, vz, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;
      
      const roadX = getRoadX ? getRoadX(vz) : 0;
      const distToRoad = Math.abs(vx - roadX);
      
      // Multi-Zone Carving: 0-7m Core (Flat), 7-25m Shoulder (Embankment)
      const roadWidth = 7; // Precise core width
      const embankmentWidth = 18; // 7 to 25m
      
      let carveFactor = 0;
      if (distToRoad <= roadWidth) {
        carveFactor = 1.0; // 100% flat road bed
      } else if (distToRoad <= roadWidth + embankmentWidth) {
        const t = (distToRoad - roadWidth) / embankmentWidth;
        carveFactor = 1.0 - (t * t * (3 - 2 * t)); // Smoothstep falloff
      }
      
      const targetHeight = getRoadHeight ? getRoadHeight(roadX, vz) : noiseH;
      const h = THREE.MathUtils.lerp(noiseH, targetHeight, carveFactor);

      vertices[i + 1] = h;

      // Drive 2011 Aesthetic: Deep Blue/Purple shadows
      let color = new THREE.Color(0x0a0a0f); 
      if (h > 40) color.set(0x333333); // Dark Grey Peaks
      else if (h > 20) color.set(0x1a1a2e); // Deep Purple/Blue
      else if (h > 5) color.set(0x0f0f1a);  // Near-Black Indigo
      
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
      emissive: 0x020205, // 0.02 boost
      emissiveIntensity: 1.0,
    });

    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.frustumCulled = false;
    this.terrain.receiveShadow = true;
    this.mesh.add(this.terrain);
    
    this.mesh.position.set(x + size / 2, 0, z - size / 2);
  }

  public dispose() {
    this.terrain.geometry.dispose();
    (this.terrain.material as THREE.Material).dispose();
  }
}
