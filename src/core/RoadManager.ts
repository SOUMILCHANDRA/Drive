import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { CONFIG } from '../config';

const ROAD_SHADER_COMMON = `
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
`;

const ROAD_VERTEX_SHADER = `
    #include <worldpos_vertex>
    vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
    vUv = uv;
`;

const ROAD_FRAGMENT_SHADER = `
    #include <emissivemap_fragment>
    
    // 1. Wet Look Specular Streaks (Sodium Orange/Teal Mix)
    float roughnessNoise = noise(vUv * 500.0);
    float spec = pow(noise(vUv * vec2(1.0, 400.0)) * 0.5 + 0.5, 8.0);
    diffuseColor.rgb += vec3(0.0, 0.4, 0.4) * spec * roughnessNoise;

    // 2. Center Dash Lines
    float dash = step(0.7, fract(vUv.x * 0.1));
    float center = 1.0 - step(0.015, abs(vUv.y - 0.5));
    totalEmissiveRadiance += vec3(1.0, 0.84, 0.0) * dash * center * 4.0;

    // 3. Edge Stitch
    float edgeMask = smoothstep(0.5, 0.45, abs(vUv.y - 0.5));
    diffuseColor.a *= edgeMask;

    // 4. Fog + Horizon
    float dist = length(vWorldPosition - cameraPosition);
    float fogFactor = 1.0 - exp(-dist * 0.003);
    vec3 fogColor = mix(vec3(0.04, 0.04, 0.06), vec3(0.5, 0.0, 0.5), clamp((dist-800.0)/1200.0, 0.0, 1.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, fogColor, clamp(fogFactor, 0.0, 1.0));
`;

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

    const roadMat = new THREE.MeshPhysicalMaterial({
        color: 0x020205, 
        roughness: 0.1, // High reflection
        metalness: 0.4, // Specular catch
        clearcoat: 0.8,
        reflectivity: 0.5,
        emissive: 0x010103,
        emissiveIntensity: 1.0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        transparent: true,
    });

    roadMat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', ROAD_SHADER_COMMON);
        shader.vertexShader = shader.vertexShader.replace('#include <common>', ROAD_SHADER_COMMON);
        shader.vertexShader = shader.vertexShader.replace('#include <worldpos_vertex>', ROAD_VERTEX_SHADER);
        shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', ROAD_FRAGMENT_SHADER);
    };

    const roadMesh = new THREE.Mesh(geometry, roadMat);
    roadMesh.frustumCulled = false;
    roadMesh.receiveShadow = true;
    roadMesh.name = "road";
    
    const chunkGroup = new THREE.Group();
    chunkGroup.add(roadMesh);

    // 2. CAT'S EYES
    const markerGeo = new THREE.BoxGeometry(0.1, 0.05, 0.3);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    for (let i = 0; i <= segments; i += 4) {
        const t = 1/3 + (i / segments) * (1/3);
        const pos = curve.getPoint(t);
        const tangent = curve.getTangent(t).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        const mLeft = new THREE.Mesh(markerGeo, markerMat);
        mLeft.position.copy(pos).add(normal.clone().multiplyScalar(-width / 2 + 0.5));
        chunkGroup.add(mLeft);

        const mRight = new THREE.Mesh(markerGeo, markerMat);
        mRight.position.copy(pos).add(normal.clone().multiplyScalar(width / 2 - 0.5));
        chunkGroup.add(mRight);
    }

    // 3. VOLUMETRIC STREETLIGHTS
    if (index % 5 === 0) { 
        const lightPos = curve.getPoint(0.5);
        const tangent = curve.getTangent(0.5).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        const sodiumColor = 0xFF9500;
        const streetLight = new THREE.PointLight(sodiumColor, 50, 100, 2);
        streetLight.position.copy(lightPos).add(normal.clone().multiplyScalar(12)).add(new THREE.Vector3(0, 15, 0));
        streetLight.castShadow = true;
        chunkGroup.add(streetLight);

        // Sodium Corona (Haze/Bloom)
        const canvas = document.createElement('canvas');
        canvas.width = 64; canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255, 149, 0, 0.8)');
        grad.addColorStop(0.5, 'rgba(255, 149, 0, 0.2)');
        grad.addColorStop(1, 'rgba(255, 149, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);
        
        const coronaMat = new THREE.SpriteMaterial({ 
            map: new THREE.CanvasTexture(canvas),
            transparent: true,
            blending: THREE.AdditiveBlending
        });
        const corona = new THREE.Sprite(coronaMat);
        corona.scale.set(6, 6, 1);
        corona.position.copy(streetLight.position);
        chunkGroup.add(corona);

        // Indigo Rim Light
        const indigoLight = new THREE.PointLight(0x4444ff, 5, 80, 2);
        indigoLight.position.copy(streetLight.position).add(new THREE.Vector3(0, 2, 0));
        chunkGroup.add(indigoLight);

        // Pole
        const poleGeo = new THREE.BoxGeometry(0.4, 15, 0.4);
        const poleMat = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            emissive: sodiumColor,
            emissiveIntensity: 3.0 
        });
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.copy(streetLight.position).sub(new THREE.Vector3(0, 7.5, 0));
        chunkGroup.add(pole);
    }

    this.roadGroup.add(chunkGroup);
    this.chunks.set(index, chunkGroup);
  }

  public getCollisionMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    this.chunks.forEach(chunk => {
        chunk.children.forEach(child => {
            if (child.name === "road") meshes.push(child);
        });
    });
    return meshes;
  }

  public isInTunnel() { return false; }
}
