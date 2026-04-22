import * as THREE from 'three';
import { CONFIG } from '../config';
import { Noise } from '../utils/Noise';

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

    const segments = 32;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    
    const vertices = geometry.attributes.position.array;
    const colors = new Float32Array(vertices.length);

    for (let i = 0; i < vertices.length; i += 3) {
      const vx = vertices[i] + x + size / 2;
      const vz = vertices[i + 2] + z - size / 2;
      
      const planet = CONFIG.PLANETS.EARTH; // Currently defaulted to Earth
      
      const noiseH = noise.fbm(vx, vz, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;
      
      const roadX = getRoadX ? getRoadX(vz) : 0;
      const distToRoad = Math.abs(vx - roadX);
      const roadWidth = 14;
      const carveRadius = 45; // Increased for natural embankments
      
      const carveFactor = 1.0 - Math.min(Math.max((distToRoad - roadWidth / 2) / carveRadius, 0), 1);
      // "Sinking" and "Lifting" the terrain to meet the road midline
      const roadHeight = noise.fbm(roadX, vz, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;
      const h = THREE.MathUtils.lerp(noiseH, roadHeight, carveFactor);

      vertices[i + 1] = h;

      // Vertex Coloring based on height and biome
      let color = new THREE.Color(0x0a0c1a); // Deep blue base
      if (h > 40) color.set(0xffffff); // Snow
      else if (h > 20) color.set(0x444444); // Rock
      else if (h > 5) color.set(0x1a331a);  // Forest green
      
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
