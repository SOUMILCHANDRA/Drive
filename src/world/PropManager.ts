import * as THREE from 'three';
import { getWorldX, getWorldHeight } from './Road';

export class PropManager {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private props: { mesh: THREE.Group | THREE.Mesh, z: number, xOff: number, light?: THREE.PointLight }[] = [];
  private count: number = 150;
  private range: number = 1000;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.spawnProps();
  }

  private spawnProps(): void {
    for (let i = 0; i < this.count; i++) {
      const z = (i / this.count) * this.range;
      this.createPropAt(z);
    }
  }

  private createPropAt(z: number): void {
    const type = Math.random();
    let mesh: THREE.Group | THREE.Mesh;
    let xOff: number;
    let light: THREE.PointLight | undefined;

    if (type < 0.3) {
        mesh = this.createStreetlight();
        xOff = Math.random() > 0.5 ? 14 : -14;
        light = new THREE.PointLight(0xF4B942, 25, 35);
        light.position.set(0, 10, 0);
        mesh.add(light);
    } else if (type < 0.5) {
        mesh = this.createNeonSign();
        xOff = (20 + Math.random() * 30) * (Math.random() > 0.5 ? 1 : -1);
        const neonColor = Math.random() > 0.5 ? 0xFF2D78 : 0x00FFEF;
        light = new THREE.PointLight(neonColor, 45, 60);
        light.position.set(0, 5, 0);
        mesh.add(light);
    } else {
        mesh = this.createBuilding();
        xOff = (60 + Math.random() * 100) * (Math.random() > 0.5 ? 1 : -1);
    }
    this.group.add(mesh);
    this.props.push({ mesh, z, xOff, light });
  }

  private createStreetlight(): THREE.Group {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 12), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    const head = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 1), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xF4B942, emissive: 0xF4B942, emissiveIntensity: 8 }));
    pole.position.y = 6;
    head.position.set(2 * (Math.random() > 0.5 ? 1 : -1), 11.5, 0);
    lamp.rotation.x = Math.PI / 2;
    lamp.position.y = -0.3;
    head.add(lamp);
    group.add(pole, head);
    return group;
  }

  private createNeonSign(): THREE.Group {
    const group = new THREE.Group();
    const color = Math.random() > 0.5 ? 0xFF2D78 : 0x00FFEF;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4, 8, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 7.5), new THREE.MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 12 }));
    neon.position.z = 0.3;
    frame.position.y = 4;
    group.add(frame, neon);
    return group;
  }

  private createBuilding(): THREE.Mesh {
    const w = 10 + Math.random() * 20;
    const h = 20 + Math.random() * 80;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), new THREE.MeshStandardMaterial({ color: 0x050505 }));
    mesh.position.y = h / 2;
    return mesh;
  }

  public update(totalDistance: number): void {
    this.props.forEach(p => {
        const zRel = (p.z - (totalDistance % this.range) + this.range) % this.range;
        const zWorld = zRel + totalDistance;
        const xCurve = getWorldX(zWorld);
        const xWorld = xCurve + p.xOff;
        const yWorld = getWorldHeight(xWorld, zWorld);
        p.mesh.position.set(xWorld, yWorld, zRel);
        if (p.light) p.light.intensity = (p.light.color.getHex() === 0xF4B942 ? 25 : 45) + Math.sin(Date.now() * 0.01) * 5;
    });
  }
}
