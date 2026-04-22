import * as THREE from 'three';

export class PropManager {
  private scene: THREE.Scene;
  private rings: THREE.Group[] = [];
  private ringGeometry: THREE.TorusGeometry;
  private ringMaterial: THREE.MeshStandardMaterial;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.ringGeometry = new THREE.TorusGeometry(3, 0.2, 8, 24);
    this.ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xff00ff,
      emissive: 0xff00ff,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.8
    });
  }

  public spawnRing(position: THREE.Vector3, orientation: THREE.Vector3) {
    const ring = new THREE.Group();
    const mesh = new THREE.Mesh(this.ringGeometry, this.ringMaterial);
    ring.add(mesh);
    ring.position.copy(position);
    ring.lookAt(position.clone().add(orientation));
    
    this.scene.add(ring);
    this.rings.push(ring);
  }

  public update(carPos: THREE.Vector3, onCollect: () => void) {
    for (let i = this.rings.length - 1; i >= 0; i--) {
        const ring = this.rings[i];
        
        // Rotation animation
        ring.children[0].rotation.z += 0.05;

        // Collision detection
        const dist = ring.position.distanceTo(carPos);
        if (dist < 4) {
            this.scene.remove(ring);
            this.rings.splice(i, 1);
            onCollect();
        }

        // Cleanup
        if (ring.position.z < carPos.z - 50) {
            this.scene.remove(ring);
            this.rings.splice(i, 1);
        }
    }
  }
}
