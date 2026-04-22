import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { CONFIG } from '../config';

export class RoadManager {
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private noise: Noise;
  
  private points: THREE.Vector3[] = [];
  private chunks: Map<number, THREE.Group> = new Map();
  private chunkSize: number = 10;
  private renderDistance: number = 60;

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    const planet = CONFIG.PLANETS.EARTH;
    const h0 = this.noise.fbm(0, -10, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;
    const h1 = this.noise.fbm(0, 0, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;
    const h2 = this.noise.fbm(0, 10, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;

    this.points.push(new THREE.Vector3(0, h0, -10));
    this.points.push(new THREE.Vector3(0, h1, 0));
    this.points.push(new THREE.Vector3(0, h2, 10));
    
    this.generateMorePoints(100);
  }

  private generateMorePoints(count: number) {
    let lastPoint = this.points[this.points.length - 1];
    let lastDir = new THREE.Vector3().subVectors(lastPoint, this.points[this.points.length - 2]).normalize();

    for (let i = 0; i < count; i++) {
        // 1. "Scouting" Logic: Test 3 directions (Left, Straight, Right)
        const angles = [-0.4, 0, 0.4];
        let bestDir = lastDir.clone();
        let minGradient = Infinity;

        for (const angle of angles) {
            const testDir = lastDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
            const testPos = lastPoint.clone().add(testDir.clone().multiplyScalar(this.chunkSize));
            
            // Sample height ahead
            const planet = CONFIG.PLANETS.EARTH;
            const h = this.noise.fbm(testPos.x, testPos.z, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;
            const gradient = Math.abs(h - lastPoint.y);
            
            // 2. Self-Intersection Check: Repulsion from history
            let repulsion = 0;
            const historyWindow = 50; // Check last 50 points
            for (let j = Math.max(0, this.points.length - historyWindow); j < this.points.length - 5; j++) {
                const dist = testPos.distanceTo(this.points[j]);
                if (dist < 150) {
                    repulsion += (150 - dist) * 10; // Strong steering bias away
                }
            }

            const score = gradient + repulsion;
            if (score < minGradient) {
                minGradient = score;
                bestDir = testDir;
            }
        }

        const newPoint = lastPoint.clone().add(bestDir.multiplyScalar(this.chunkSize));
        const planet = CONFIG.PLANETS.EARTH;
        newPoint.y = this.noise.fbm(newPoint.x, newPoint.z, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;
        
        // 3. 9-Point Smoothing Retroactively
        this.points.push(newPoint);
        if (this.points.length > 10) {
            this.smoothPoints(this.points.length - 5);
        }

        lastPoint = newPoint;
        lastDir = bestDir;
    }
  }

  private smoothPoints(index: number) {
    const window = 4;
    let sumY = 0;
    let count = 0;
    for (let i = index - window; i <= index + window; i++) {
        if (i >= 0 && i < this.points.length) {
            sumY += this.points[i].y;
            count++;
        }
    }
    this.points[index].y = sumY / count;
  }

  private updateSpline() {
    // No longer using global spline for meshes
  }

  public getRoadHeight(_x: number, z: number): number {
    // Return interpolated height from spline points for perfect terrain sync
    const index = Math.floor((z + 20) / this.chunkSize);
    if (index < 0 || index >= this.points.length - 1) return 0;
    
    const p1 = this.points[index];
    const p2 = this.points[index + 1];
    const t = (z - p1.z) / (p2.z - p1.z);
    return THREE.MathUtils.lerp(p1.y, p2.y, THREE.MathUtils.clamp(t, 0, 1));
  }

  public getRoadX(z: number): number {
    // Estimate X position of road at Z by finding nearest spline point
    const index = this.points.findIndex(p => p.z > z) - 1;
    if (index < 0 || index >= this.points.length - 1) return 0;
    
    const p1 = this.points[index];
    const p2 = this.points[index + 1];
    const t = (z - p1.z) / (p2.z - p1.z);
    return THREE.MathUtils.lerp(p1.x, p2.x, THREE.MathUtils.clamp(t, 0, 1));
  }

  public getAutopilotTarget(z: number) {
    const index = this.points.findIndex(p => p.z > z) - 1;
    if (index < 0 || index >= this.points.length - 1) return { x: 0, y: 0, z: z, angle: 0 };
    
    const p1 = this.points[index];
    const p2 = this.points[index + 1];
    const t = (z - p1.z) / (p2.z - p1.z);
    
    const pos = new THREE.Vector3().lerpVectors(p1, p2, THREE.MathUtils.clamp(t, 0, 1));
    const angle = Math.atan2(p2.x - p1.x, p2.z - p1.z);
    
    return { x: pos.x, y: pos.y, z: pos.z, angle: angle };
  }

  public update(playerZ: number) {
    const currentChunkIndex = Math.floor(playerZ / this.chunkSize);
    
    for (let i = -1; i < this.renderDistance; i++) {
        const index = currentChunkIndex + i;
        if (index < 0) continue;
        if (!this.chunks.has(index)) this.createChunkMesh(index);
    }

    for (const [index, group] of this.chunks.entries()) {
      if (index < currentChunkIndex - 2 || index > currentChunkIndex + this.renderDistance) {
        this.roadGroup.remove(group);
        this.chunks.delete(index);
      }
    }

    if (playerZ > (this.points.length - 100) * this.chunkSize) {
        this.generateMorePoints(100);
        this.updateSpline();
    }
  }

  private createChunkMesh(index: number) {
    if (index < 0 || index >= this.points.length - 1) return;

    // Use local points for stable curve generation
    const p0 = this.points[Math.max(0, index - 1)];
    const p1 = this.points[index];
    const p2 = this.points[index + 1];
    const p3 = this.points[Math.min(this.points.length - 1, index + 2)];

    const curve = new THREE.CatmullRomCurve3([p0, p1, p2, p3]);
    const segments = 20;
    const width = 14;
    
    // 1. CUSTOM RIBBON GEOMETRY: Spline-Space UVs
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let i = 0; i <= segments; i++) {
        const t = 1/3 + (i / segments) * (1/3);
        const pos = curve.getPoint(t);
        const tangent = curve.getTangent(t).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        // Left and Right vertices
        const left = pos.clone().add(normal.clone().multiplyScalar(-width / 2));
        const right = pos.clone().add(normal.clone().multiplyScalar(width / 2));

        vertices.push(left.x, left.y, left.z, right.x, right.y, right.z);
        
        // UVs: U = distance along spline, V = across (-1 to 1)
        const u = (index * this.chunkSize) + (i / segments) * this.chunkSize;
        uvs.push(u, 0, u, 1);

        if (i < segments) {
            const base = i * 2;
            indices.push(base, base + 1, base + 2);
            indices.push(base + 1, base + 3, base + 2);
        }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    const roadMat = new THREE.MeshStandardMaterial({
        color: 0x020205, // Deep Indigo shadows
        roughness: 0.1,  // Wet look (low roughness)
        metalness: 0.8,  // High metalness for reflections
        polygonOffset: true,
        polygonOffsetFactor: -1,
        transparent: true,
    });

    roadMat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `
            #include <common>
            varying vec2 vUv;
            varying vec3 vWorldPosition;

            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
                vec2 i = floor(p); vec2 f = fract(p);
                vec2 u = f*f*(3.0-2.0*f);
                return mix(mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
                           mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
            }
            `
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `
            #include <common>
            varying vec2 vUv;
            varying vec3 vWorldPosition;
            `
        ).replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>
            vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vUv = uv;
            `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `
            #include <emissivemap_fragment>
            
            // 1. Wet Look Specular Noise
            float spec = noise(vUv * 100.0) * 0.5;
            diffuseColor.rgb += vec3(0.0, 0.5, 0.5) * spec; // Teal road highlights

            // 2. Center Dash Lines (Amber Glow)
            float dash = step(0.7, fract(vUv.x * 0.1));
            float center = 1.0 - step(0.015, abs(vUv.y - 0.5));
            totalEmissiveRadiance += vec3(1.0, 0.84, 0.0) * dash * center * 4.0; // Amber/Gold

            // 3. Edge Stitch
            float edgeMask = smoothstep(0.5, 0.45, abs(vUv.y - 0.5));
            diffuseColor.a *= edgeMask;

            // 4. Exponential Fog + Magenta Horizon Afterglow
            float dist = length(vWorldPosition - cameraPosition);
            float fogFactor = 1.0 - exp(-dist * 0.003);
            vec3 fogColor = mix(vec3(0.04, 0.04, 0.06), vec3(0.5, 0.0, 0.5), clamp((dist-800.0)/1200.0, 0.0, 1.0));
            diffuseColor.rgb = mix(diffuseColor.rgb, fogColor, clamp(fogFactor, 0.0, 1.0));
            `
        );
    };

    const roadMesh = new THREE.Mesh(geometry, roadMat);
    roadMesh.receiveShadow = true;
    
    const chunkGroup = new THREE.Group();
    chunkGroup.add(roadMesh);

    // 2. VECTOR VIZ: Keep for math confirmation
    for (let i = 0; i <= 2; i++) {
        const t = 1/3 + (i / 2) * (1/3);
        const p = curve.getPoint(t);
        const upArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), p, 1.5, 0x00ff00);
        chunkGroup.add(upArrow);
    }

    if (index % 10 === 0) { 
        const lightPos = curve.getPoint(0.5);
        const light = new THREE.PointLight(0xFFB347, 5.0, 100, 1.5);
        light.position.set(lightPos.x + 12, lightPos.y + 12, lightPos.z);
        chunkGroup.add(light);
    }

    // Removed flat terrain plane to prevent clipping with WorldManager procedural terrain

    this.roadGroup.add(chunkGroup);
    this.chunks.set(index, chunkGroup);
  }

  public isInTunnel() { return false; }
}
