import * as THREE from 'three';
import { NeonSign } from './NeonSign';
import { AsphaltShader } from '../shaders/AsphaltShader';
import type { QualityConfig } from '../core/QualitySettings';
import { BiomeManager } from './BiomeManager';
import type { BiomeParams } from './BiomeManager';

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

  public activate(startZ: number, points: THREE.Vector3[], scene: THREE.Scene, params: BiomeParams): void {
    this.startZ = startZ;
    this.curve = new THREE.CatmullRomCurve3(points);
    this.updateGeometry();
    this.generateCity(scene, params);
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

  private generateCity(scene: THREE.Scene, params: BiomeParams): void {
      this.cityGroup.clear();
      this.neonSigns = [];

      if (params.name === 'TUNNEL') {
          this.generateTunnel();
          scene.add(this.cityGroup);
          return;
      }

      const segments = 20; 
      for (let i = 0; i < segments; i++) {
          const t = i / segments;
          const worldPos = this.curve.getPoint(t);
          const tangent = this.curve.getTangent(t);
          const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

          [1, -1].forEach(side => {
              if (Math.random() < params.buildingDensity) {
                  const h = params.buildingHeight[0] + Math.random() * (params.buildingHeight[1] - params.buildingHeight[0]);
                  const w = 12 + Math.random() * 10;
                  const dist = 18 + Math.random() * 5;
                  const building = this.createBuilding(w, h, 20);
                  const pos = worldPos.clone().add(normal.clone().multiplyScalar(side * dist));
                  building.position.copy(pos);
                  building.position.y = h / 2;
                  building.lookAt(worldPos.clone().setY(h/2));
                  this.cityGroup.add(building);

                  if (Math.random() < params.neonDensity) {
                      const sign = new NeonSign();
                      sign.position.set(0, (Math.random() * h / 4), 10.5); 
                      building.add(sign);
                      this.neonSigns.push(sign);
                  }
              }

              if (params.name !== 'HIGHWAY' && params.name !== 'TUNNEL' && i % 4 === 0 && Math.random() > 0.5) {
                  const palm = this.createPalm();
                  const pos = worldPos.clone().add(normal.clone().multiplyScalar(side * 13));
                  palm.position.copy(pos);
                  this.cityGroup.add(palm);
              }
          });
      }
      scene.add(this.cityGroup);
  }

  private generateTunnel(): void {
      const tunnelGeom = new THREE.CylinderGeometry(25, 25, 500, 16, 1, true, Math.PI, Math.PI);
      const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, side: THREE.BackSide, roughness: 0.1 });
      const tunnel = new THREE.Mesh(tunnelGeom, tunnelMat);
      tunnel.rotation.z = Math.PI / 2;
      tunnel.position.set(0, 0, this.startZ + 250);
      this.cityGroup.add(tunnel);

      for (let i = 0; i < 5; i++) {
          const light = new THREE.PointLight(0xffaa00, 100, 80);
          light.position.set(0, 18, this.startZ + (i * 100) + 50);
          this.cityGroup.add(light);
      }
  }

  public update(delta: number): void {
      this.neonSigns.forEach(s => s.update(delta));
  }

  private createBuilding(w: number, h: number, d: number): THREE.Mesh {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mat = new THREE.MeshStandardMaterial({ color: 0x050508, roughness: 0.8 });
      if (Math.random() > 0.2) {
          mat.emissive = new THREE.Color(0xF4B942);
          mat.emissiveIntensity = 0.05;
      }
      return new THREE.Mesh(geo, mat);
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
  private material: THREE.ShaderMaterial;
  private lineMaterial: THREE.LineBasicMaterial;
  public biomeManager: BiomeManager;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.biomeManager = new BiomeManager();
    this.material = new THREE.ShaderMaterial(AsphaltShader);
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
      for (let i = 0; i < 6; i++) {
          const z = i * 500;
          this.spawnChunk(z, this.biomeManager.getParamsAt(z));
      }
  }

  private spawnChunk(z: number, params: BiomeParams): void {
      const chunk = this.pool.pop();
      if (!chunk) return;
      
      const wpIndex = Math.floor(z / 500);
      if (this.waypoints.length <= wpIndex + 4) {
          for (let i = this.waypoints.length; i <= wpIndex + 6; i++) this.addWaypoint(i * 500);
      }
      
      const points = this.waypoints.slice(wpIndex, wpIndex + 4);
      chunk.activate(z, points, this.scene, params);
      this.scene.add(chunk.mesh, chunk.lines);
      this.chunks.push(chunk);
  }

  public getRoadPositionAt(z: number): { position: THREE.Vector3, tangent: THREE.Vector3 } {
      const safeZ = Math.max(0, z);
      const wpIndex = Math.max(0, Math.floor(safeZ / 500));
      const t = (safeZ % 500) / 500;
      
      if (this.waypoints.length <= wpIndex + 4) {
          for (let i = this.waypoints.length; i <= wpIndex + 6; i++) this.addWaypoint(i * 500);
      }
      
      const points = this.waypoints.slice(wpIndex, wpIndex + 4);
      if (points.length < 2) return { position: new THREE.Vector3(0, 0, safeZ), tangent: new THREE.Vector3(0, 0, 1) };

      const curve = new THREE.CatmullRomCurve3(points);
      return { position: curve.getPoint(t), tangent: curve.getTangent(t) };
  }

  public update(carZ: number, carSpeed: number, delta: number, config: QualityConfig): void {
      this.chunks.forEach(c => c.update(delta));
      
      this.material.uniforms.uTime.value += delta;
      this.material.uniforms.uSpeed.value = carSpeed;

      const lookahead = config.chunkLimit * 500;
      if (this.chunks.length > 0 && carZ - this.chunks[0].startZ > 800) {
          const old = this.chunks.shift();
          if (old) {
              this.scene.remove(old.mesh, old.lines, old.cityGroup);
              this.pool.push(old);
          }
      }
      const lastChunk = this.chunks[this.chunks.length - 1];
      if (lastChunk.startZ - carZ < lookahead) {
          const nextZ = lastChunk.startZ + 500;
          this.spawnChunk(nextZ, this.biomeManager.getParamsAt(nextZ));
      }
  }
}
