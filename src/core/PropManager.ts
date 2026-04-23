import * as THREE from 'three';
import { getWorldX } from './RoadManager';

/**
 * PropManager: Dense forest, bushes, and stone walls following the road.
 */
export class PropManager {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private props: { mesh: THREE.Group | THREE.Mesh, z: number, xOff: number }[] = [];
  private count: number = 400; // Even denser forest
  private range: number = 1200;

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

    if (type < 0.1) {
        mesh = this.createStoneWall();
        xOff = Math.random() > 0.5 ? 7.5 : -7.5;
    } else if (type < 0.3) {
        mesh = this.createTree();
        xOff = (12 + Math.random() * 25) * (Math.random() > 0.5 ? 1 : -1);
    } else if (type < 0.6) {
        mesh = this.createBush();
        xOff = (7 + Math.random() * 8) * (Math.random() > 0.5 ? 1 : -1);
    } else {
        mesh = this.createGrass();
        xOff = (6 + Math.random() * 3) * (Math.random() > 0.5 ? 1 : -1);
    }

    this.group.add(mesh);
    this.props.push({ mesh, z, xOff });
  }

  private createGrass(): THREE.Group {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x052205 });
    for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.6), mat);
        blade.rotation.y = Math.random() * Math.PI;
        blade.rotation.x = Math.random() * 0.5;
        blade.position.set(Math.random() * 0.5, 0.3, Math.random() * 0.5);
        group.add(blade);
    }
    return group;
  }

  private createTree(): THREE.Group {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 3), new THREE.MeshStandardMaterial({ color: 0x110800 }));
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(2, 6, 6), new THREE.MeshStandardMaterial({ color: 0x011501 }));
    trunk.position.y = 1.5; leaves.position.y = 5;
    group.add(trunk, leaves);
    return group;
  }

  private createBush(): THREE.Mesh {
    return new THREE.Mesh(new THREE.SphereGeometry(Math.random() * 1 + 0.5, 4, 4), new THREE.MeshStandardMaterial({ color: 0x021102 }));
  }

  private createStoneWall(): THREE.Mesh {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    wall.position.y = 0.6;
    return wall;
  }

  public update(totalDistance: number): void {
    this.props.forEach(p => {
        let zWorld = (p.z - (totalDistance % this.range) + this.range) % this.range;
        const xCurve = getWorldX(zWorld + totalDistance);
        p.mesh.position.set(xCurve + p.xOff, p.mesh.position.y, zWorld);
        
        // Orient wall to road
        if (p.xOff === 7.5 || p.xOff === -7.5) {
            const nextZ = zWorld + 1;
            const nextX = getWorldX(nextZ + totalDistance);
            p.mesh.lookAt(nextX + p.xOff, p.mesh.position.y, nextZ);
        }
    });
  }
}
