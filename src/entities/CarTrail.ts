import * as THREE from 'three';

export class CarTrail {
  private mesh: THREE.Mesh;
  private scene: THREE.Scene;
  private maxPoints: number = 100;
  private points: THREE.Vector3[] = [];
  private geometry: THREE.PlaneGeometry;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    
    this.geometry = new THREE.PlaneGeometry(1, 1, 1, this.maxPoints - 1);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.scene.add(this.mesh);
  }

  public update(pos: THREE.Vector3, color: THREE.Color) {
    this.points.unshift(pos.clone());
    if (this.points.length > this.maxPoints) {
      this.points.pop();
    }

    const posAttr = this.geometry.attributes.position;
    for (let i = 0; i < this.points.length; i++) {
        const p = this.points[i];
        // Left vertex
        posAttr.setXYZ(i * 2, p.x - 0.5, p.y, p.z);
        // Right vertex
        posAttr.setXYZ(i * 2 + 1, p.x + 0.5, p.y, p.z);
    }
    posAttr.needsUpdate = true;
    (this.mesh.material as THREE.MeshBasicMaterial).color.copy(color);
  }
}
