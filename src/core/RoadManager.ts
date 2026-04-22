import * as THREE from 'three';
import { Noise } from '../utils/Noise';
import { CONFIG } from '../config';

export class RoadManager {
  private roadGroup: THREE.Group;
  private scene: THREE.Scene;
  private noise: Noise;
  
  private points: THREE.Vector3[] = [];
  private tunnelChunks: Set<number> = new Set();
  private chunks: Map<number, THREE.Mesh> = new Map();
  private chunkSize: number = CONFIG.ROAD.CHUNK_SIZE;
  private roadWidth: number = CONFIG.ROAD.WIDTH;
  private renderDistance: number = CONFIG.ROAD.RENDER_DISTANCE;
  
  private spline: THREE.CatmullRomCurve3 | null = null;
  private roadMaterial: THREE.MeshStandardMaterial;
  private terrainMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene, noise: Noise) {
    this.scene = scene;
    this.noise = noise;
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);

    // DRIVE Aesthetic Materials: Wet asphalt & Matte dirt
    this.roadMaterial = new THREE.MeshStandardMaterial({
      color: CONFIG.ROAD.COLOR,
      roughness: 0.3,
      metalness: 0.6,
      emissive: 0xffffff,
      emissiveIntensity: 0.05 // Subtle sheen
    });

    this.terrainMaterial = new THREE.MeshStandardMaterial({
      color: 0x0d0d0d,
      roughness: 1.0,
      metalness: 0
    });

    this.points.push(new THREE.Vector3(0, 0, -50));
    this.points.push(new THREE.Vector3(0, 0, 0));
    this.points.push(new THREE.Vector3(0, 0, 50));
    
    this.generateMorePoints(10);
    this.updateSpline();
  }

  private generateMorePoints(count: number) {
    let lastPoint = this.points[this.points.length - 1];
    let lastDir = new THREE.Vector3().subVectors(lastPoint, this.points[this.points.length - 2]).normalize();

    for (let i = 0; i < count; i++) {
        const index = this.points.length;
        const angle = (this.noise.get(index * 10, 0, 1, 0.5, 1) - 0.5) * 0.4;
        const pitch = (this.noise.get(0, index * 10, 1, 0.5, 1) - 0.5) * 0.15;

        const newDir = lastDir.clone()
            .applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
            .applyAxisAngle(new THREE.Vector3(1, 0, 0), pitch)
            .normalize();

        const newPoint = lastPoint.clone().add(newDir.multiplyScalar(50));
        this.points.push(newPoint);
        lastPoint = newPoint;
        lastDir = newDir;
    }
  }

  private updateSpline() {
    this.spline = new THREE.CatmullRomCurve3(this.points);
  }

  public getRoadHeight(_x: number, z: number): number {
    if (!this.spline) return 0;
    const t = THREE.MathUtils.clamp((z + 50) / (this.points.length * 50), 0, 1);
    return this.spline.getPointAt(t).y;
  }

  public getPoints() { return this.points; }

  public update(playerZ: number) {
    const currentChunkIndex = Math.floor(playerZ / this.chunkSize);
    
    for (let i = -1; i < this.renderDistance; i++) {
        const index = currentChunkIndex + i;
        if (index < 0) continue;
        if (!this.chunks.has(index)) this.createChunkMesh(index);
    }

    for (const [index, mesh] of this.chunks.entries()) {
      if (index < currentChunkIndex - 2 || index > currentChunkIndex + this.renderDistance) {
        this.roadGroup.remove(mesh);
        mesh.children.forEach(c => {
          if (c instanceof THREE.Mesh) {
            c.geometry.dispose();
            (c.material as THREE.Material).dispose();
          }
        });
        this.chunks.delete(index);
      }
    }

    if (playerZ > (this.points.length - 12) * 50) {
        this.generateMorePoints(10);
        this.updateSpline();
    }
  }

  private createChunkMesh(index: number) {
    const startT = (index * this.chunkSize) / (this.points.length * 50);
    const endT = ((index + 1) * this.chunkSize) / (this.points.length * 50);
    
    const segmentPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
        segmentPoints.push(this.spline!.getPointAt(startT + (endT - startT) * (i / 10)));
    }

    const curve = new THREE.CatmullRomCurve3(segmentPoints);
    const geometry = new THREE.TubeGeometry(curve, 10, this.roadWidth / 2, 2, false);
    const roadMesh = new THREE.Mesh(geometry, this.roadMaterial.clone());
    roadMesh.scale.y = 0.05;
    roadMesh.receiveShadow = true;
    
    const chunkGroup = new THREE.Group();
    chunkGroup.add(roadMesh);

    // Center Marking: White thin line
    const markingGeo = new THREE.TubeGeometry(curve, 10, 0.1, 2, false);
    const markingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: CONFIG.ROAD.MARKING_EMISSIVE
    });
    const marking = new THREE.Mesh(markingGeo, markingMat);
    marking.scale.y = 0.06;
    marking.position.y = 0.01;
    chunkGroup.add(marking);

    // Roadside Streetlights (Sodium Orange every ~80m)
    if (index % 1 === 0) {
        const lightPos = this.spline!.getPointAt(startT + (endT - startT) * 0.5);
        const light = new THREE.PointLight(CONFIG.LIGHTING.STREETLIGHT_COLOR, CONFIG.LIGHTING.STREETLIGHT_INTENSITY, 25, 2);
        light.position.copy(lightPos).add(new THREE.Vector3(8, 6, 0));
        chunkGroup.add(light);
        
        const pole = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 6, 0.2),
            new THREE.MeshStandardMaterial({ color: 0x050505 })
        );
        pole.position.copy(lightPos).add(new THREE.Vector3(8, 3, 0));
        chunkGroup.add(pole);
    }

    // Terrain Silhouettes
    const terrainGeo = new THREE.PlaneGeometry(200, this.chunkSize, 4, 4);
    const tL = new THREE.Mesh(terrainGeo, this.terrainMaterial);
    tL.rotation.x = -Math.PI / 2;
    tL.position.copy(this.spline!.getPointAt(startT + (endT - startT) * 0.5));
    tL.position.x -= 110;
    chunkGroup.add(tL);

    const tR = tL.clone();
    tR.position.x += 220;
    chunkGroup.add(tR);

    this.roadGroup.add(chunkGroup);
    this.chunks.set(index, chunkGroup as any);
  }

  public isInTunnel() { return false; } // Removed for DRIVE aesthetic
}
