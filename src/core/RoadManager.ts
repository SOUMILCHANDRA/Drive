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
  private roadWidth: number = CONFIG.ROAD.WIDTH;
  private renderDistance: number = 60;
  
  private roadMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: 0xff00ff, // DEBUG MAGENTA
      roughness: 0.4,
      metalness: 0.3,
      side: THREE.DoubleSide
    });

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

  public getRoadHeight(x: number, z: number): number {
    const planet = CONFIG.PLANETS.EARTH;
    return this.noise.fbm(x, z, planet.OCTAVES, planet.PERSISTENCE, planet.SCALE) * planet.ELEVATION;
  }

  public getRoadX(z: number): number {
    // Estimate X position of road at Z by finding nearest spline point
    // This is used for terrain carving
    const index = Math.floor((z + 20) / this.chunkSize);
    if (index < 0 || index >= this.points.length - 1) return 0;
    
    const p1 = this.points[index];
    const p2 = this.points[index + 1];
    const t = (z - p1.z) / (p2.z - p1.z);
    return THREE.MathUtils.lerp(p1.x, p2.x, THREE.MathUtils.clamp(t, 0, 1));
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
    // The segment between p1 and p2 is roughly t=1/3 to t=2/3 in a 4-point curve if distances are equal.
    // However, an easier way is to just create a curve from p1 to p2 and use start/end tangents.
    // Three.js CatmullRomCurve3 maps t=0 to the first point and t=1 to the last point, but if we want 
    // the segment between p1 and p2, we evaluate from t=1/3 to t=2/3.
    // Actually, to make it perfectly align, we extract the segment points:
    const segmentPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
        segmentPoints.push(curve.getPoint(1/3 + (i/10) * (1/3)));
    }
    
    const localCurve = new THREE.CatmullRomCurve3(segmentPoints);
    const geometry = new THREE.TubeGeometry(localCurve, 10, this.roadWidth / 2, 8, false);
    const roadMesh = new THREE.Mesh(geometry, this.roadMaterial);
    roadMesh.scale.y = 0.02; // Flatten to ribbon
    roadMesh.receiveShadow = true;
    
    const chunkGroup = new THREE.Group();
    chunkGroup.add(roadMesh);

    // Center Marking
    const markingGeo = new THREE.TubeGeometry(localCurve, 10, 0.15, 8, false);
    const markingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.5
    });
    const marking = new THREE.Mesh(markingGeo, markingMat);
    marking.scale.y = 0.03;
    marking.position.y = 0.01;
    chunkGroup.add(marking);

    // Side Neon Markers (Reflective depth)
    const addSideMarkers = (side: number, color: number) => {
        const markerMat = new THREE.MeshStandardMaterial({
            color: color,
            emissive: color,
            emissiveIntensity: 3.0
        });
        const markerGeo = new THREE.SphereGeometry(0.12, 8, 8);
        for (let i = 0; i <= 2; i++) {
            const p = localCurve.getPoint(i / 2);
            const tangent = localCurve.getTangent(i / 2);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
            
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.copy(p).add(normal.multiplyScalar(side * (this.roadWidth / 2 - 0.2)));
            marker.position.y += 0.1;
            chunkGroup.add(marker);
        }
    };
    addSideMarkers(1, 0xFF2D95);  // Hot Pink
    addSideMarkers(-1, 0x00E5FF); // Electric Blue

    // Streetlight poles removed for debug clarity
    if (index % 10 === 0) { 
        const lightPos = localCurve.getPoint(0.5);
        const sideOffset = new THREE.Vector3(12, 0, 0); 
        const poleWorldPos = lightPos.clone().add(sideOffset);
        
        const light = new THREE.PointLight(0xFFB347, 5.0, 100, 1.5);
        light.position.set(poleWorldPos.x, lightPos.y + 12, poleWorldPos.z);
        chunkGroup.add(light);
    }

    // Removed flat terrain plane to prevent clipping with WorldManager procedural terrain

    this.roadGroup.add(chunkGroup);
    this.chunks.set(index, chunkGroup);
  }

  public isInTunnel() { return false; }
}
