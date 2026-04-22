import * as THREE from 'three';

export class SpeedLines {
  private mesh: THREE.LineSegments;
  private count: number = 200;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 6); // 2 points per line
    
    for (let i = 0; i < this.count; i++) {
        this.resetLine(positions, i);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending
    });

    this.mesh = new THREE.LineSegments(geometry, material);
    this.scene.add(this.mesh);
  }

  private resetLine(positions: Float32Array, i: number, playerPos?: THREE.Vector3) {
    const range = 40;
    const center = playerPos || new THREE.Vector3(0, 0, 0);
    
    const x = (Math.random() - 0.5) * range;
    const y = (Math.random() - 0.5) * range;
    const z = center.z + 100 + Math.random() * 100;
    const len = 5 + Math.random() * 10;

    positions[i * 6] = center.x + x;
    positions[i * 6 + 1] = center.y + y;
    positions[i * 6 + 2] = z;
    
    positions[i * 6 + 3] = center.x + x;
    positions[i * 6 + 4] = center.y + y;
    positions[i * 6 + 5] = z + len;
  }

  public update(playerPos: THREE.Vector3, velocity: number) {
    const posAttr = this.mesh.geometry.attributes.position;
    const positions = posAttr.array as Float32Array;

    const intensity = THREE.MathUtils.clamp((velocity - 40) / 20, 0, 1);
    (this.mesh.material as THREE.LineBasicMaterial).opacity = intensity * 0.4;

    for (let i = 0; i < this.count; i++) {
      positions[i * 6 + 2] -= velocity * 0.5;
      positions[i * 6 + 5] -= velocity * 0.5;

      if (positions[i * 6 + 5] < playerPos.z - 20) {
        this.resetLine(positions, i, playerPos);
      }
    }
    posAttr.needsUpdate = true;
  }
}
