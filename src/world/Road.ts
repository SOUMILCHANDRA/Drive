import * as THREE from 'three';
import { NeonSign } from './NeonSign';

/**
 * RoadChunk: A 500-unit segment of the LA Freeway with Procedural City Dressing.
 */
class RoadChunk {
  public mesh: THREE.Mesh;
  public lines: THREE.LineSegments;
  public cityGroup: THREE.Group;
  private neonSigns: NeonSign[] = [];
  public startZ: number = 0;
  public length: number = 500;
  public curve: THREE.CatmullRomCurve3;

  constructor(material: THREE.Material, lineMaterial: THREE.Material) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 500, 1, 50), material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
    this.curve = new THREE.CatmullRomCurve3();
    this.cityGroup = new THREE.Group();
  }

  public activate(startZ: number, points: THREE.Vector3[], scene: THREE.Scene): void {
    this.startZ = startZ;
    this.curve = new THREE.CatmullRomCurve3(points);
    this.updateGeometry();
    this.generateCity(scene);
  }

  private updateGeometry(): void {
    const pos = this.mesh.geometry.attributes.position;
    const segments = 50;
    const width = 14; 

    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const worldPos = this.curve.getPoint(t);
        const tangent = this.curve.getTangent(t);
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        pos.setXYZ(i * 2, worldPos.x - normal.x * (width / 2), 0, worldPos.z);
        pos.setXYZ(i * 2 + 1, worldPos.x + normal.x * (width / 2), 0, worldPos.z);
    }
    pos.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
    this.updateLines();
  }

  private updateLines(): void {
      const linePos: number[] = [];
      const segments = 100;
      for (let i = 0; i < segments; i++) {
          if (i % 5 === 0) continue; 
          const p1 = this.curve.getPoint(i / segments);
          const p2 = this.curve.getPoint((i + 1) / segments);
          linePos.push(p1.x, 0.05, p1.z, p2.x, 0.05, p2.z);
      }
      this.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
  }

  private generateCity(scene: THREE.Scene): void {
      this.cityGroup.clear();
      const segments = 20; 
      
      for (let i = 0; i < segments; i++) {
          const t = i / segments;
          const worldPos = this.curve.getPoint(t);
          const tangent = this.curve.getTangent(t);
          const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

          // Left & Right Building Placement
          [1, -1].forEach(side => {
              if (Math.random() > 0.3) { // 70% density
                  const h = 10 + Math.random() * 40;
                  const w = 15 + Math.random() * 15;
                  const dist = 18 + Math.random() * 5;
                  const building = this.createBuilding(w, h, 20);
                  const pos = worldPos.clone().add(normal.clone().multiplyScalar(side * dist));
                  building.position.copy(pos);
                  building.position.y = h / 2;
                  building.lookAt(worldPos.clone().setY(h/2));
                  this.cityGroup.add(building);

                  // 10% Neon Sign coverage
                  if (Math.random() > 0.9) {
                      const sign = new NeonSign();
                      sign.position.set(0, (Math.random() * h / 2), 10.5); // On building face
                      building.add(sign);
                      this.neonSigns.push(sign);
                  }
              }

              // Streetlights every few segments
              if (i % 3 === 0) {
                  const light = this.createStreetlight();
                  const pos = worldPos.clone().add(normal.clone().multiplyScalar(side * 10));
                  light.position.copy(pos);
                  light.lookAt(worldPos);
                  this.cityGroup.add(light);
              }
              
              // Palm Trees
              if (Math.random() > 0.6) {
                  const palm = this.createPalm();
                  const pos = worldPos.clone().add(normal.clone().multiplyScalar(side * 13));
                  palm.position.copy(pos);
                  this.cityGroup.add(palm);
              }
          });
      }
      scene.add(this.cityGroup);
  }

  public update(delta: number): void {
      this.neonSigns.forEach(s => s.update(delta));
  }

  private createBuilding(w: number, h: number, d: number): THREE.Mesh {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({ 
          color: 0x050508,
          roughness: 0.8
      });
      // Window emissive effect
      if (Math.random() > 0.2) {
          mat.emissive = new THREE.Color(0xF4B942);
          mat.emissiveIntensity = 0.05;
      }
      return new THREE.Mesh(geo, mat);
  }

  private createStreetlight(): THREE.Group {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      const bulb = new THREE.PointLight(0xF4B942, 15, 25);
      
      pole.position.y = 6;
      lamp.position.set(1.5, 11.5, 0);
      bulb.position.set(1.5, 11, 0);
      group.add(pole, lamp, bulb);
      return group;
  }

  private createPalm(): THREE.Group {
      const group = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 15), new THREE.MeshStandardMaterial({ color: 0x1a1510 }));
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8), new THREE.MeshStandardMaterial({ color: 0x051a05 }));
      trunk.position.y = 7.5;
      canopy.position.y = 15;
      group.add(trunk, canopy);
      return group;
  }
}

export class Road {
  private scene: THREE.Scene;
  private chunks: RoadChunk[] = [];
  private pool: RoadChunk[] = [];
  private waypoints: THREE.Vector3[] = [];
  private material: THREE.MeshStandardMaterial;
  private lineMaterial: THREE.LineBasicMaterial;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.material = new THREE.MeshStandardMaterial({ color: 0x1C1C24, metalness: 0.9, roughness: 0.1 });
    this.lineMaterial = new THREE.LineBasicMaterial({ color: 0xF4B942 });

    for (let i = 0; i < 20; i++) this.addWaypoint(i * 500);
    this.initPool();
    this.spawnInitialChunks();
  }

  private addWaypoint(z: number): void {
      const lastX = this.waypoints.length > 0 ? this.waypoints[this.waypoints.length - 1].x : 0;
      const x = lastX + (Math.random() - 0.5) * 60; 
      this.waypoints.push(new THREE.Vector3(x, 0, z));
  }

  private initPool(): void {
      for (let i = 0; i < 12; i++) {
          this.pool.push(new RoadChunk(this.material, this.lineMaterial));
      }
  }

  private spawnInitialChunks(): void {
      for (let i = 0; i < 6; i++) this.spawnChunk(i * 500);
  }

  private spawnChunk(startZ: number): void {
      const chunk = this.pool.pop();
      if (!chunk) return;
      const wpIndex = Math.floor(startZ / 500);
      const points = this.waypoints.slice(wpIndex, wpIndex + 4);
      chunk.activate(startZ, points, this.scene);
      this.scene.add(chunk.mesh, chunk.lines);
      this.chunks.push(chunk);
  }

  public getRoadPositionAt(z: number): { position: THREE.Vector3, tangent: THREE.Vector3 } {
      const wpIndex = Math.floor(z / 500);
      const t = (z % 500) / 500;
      if (this.waypoints.length <= wpIndex + 4) {
          for (let i = this.waypoints.length; i <= wpIndex + 6; i++) this.addWaypoint(i * 500);
      }
      const curve = new THREE.CatmullRomCurve3(this.waypoints.slice(wpIndex, wpIndex + 4));
      return { position: curve.getPoint(t), tangent: curve.getTangent(t) };
  }

  public update(carZ: number, delta: number): void {
      // Update animations (Neon, etc)
      this.chunks.forEach(c => c.update(delta));

      if (this.chunks.length > 0 && carZ - this.chunks[0].startZ > 800) {
          const old = this.chunks.shift();
          if (old) {
              this.scene.remove(old.mesh, old.lines, old.cityGroup);
              this.pool.push(old);
          }
      }
      const lastChunk = this.chunks[this.chunks.length - 1];
      if (lastChunk.startZ - carZ < 2500) this.spawnChunk(lastChunk.startZ + 500);
  }
}

export const getWorldX = (z: number) => Math.sin(z * 0.003) * 20;
export const getWorldHeight = () => 0;
