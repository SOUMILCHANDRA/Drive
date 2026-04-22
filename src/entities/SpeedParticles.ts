import * as THREE from 'three';

export class SpeedParticles {
  private particles: THREE.Points;
  private count: number = 200;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.count * 3);
    
    for (let i = 0; i < this.count; i++) {
        this.resetParticle(positions, i);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: 0x00f3ff,
      size: 0.1,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  private resetParticle(positions: Float32Array, i: number, playerPos?: THREE.Vector3) {
    const range = 50;
    if (playerPos) {
        positions[i * 3] = playerPos.x + (Math.random() - 0.5) * range;
        positions[i * 3 + 1] = playerPos.y + (Math.random() - 0.5) * range;
        positions[i * 3 + 2] = playerPos.z + 50 + Math.random() * 50; // In front
    } else {
        positions[i * 3] = (Math.random() - 0.5) * range;
        positions[i * 3 + 1] = (Math.random() - 0.5) * range;
        positions[i * 3 + 2] = (Math.random() - 0.5) * range;
    }
  }

  public update(playerPos: THREE.Vector3, velocity: number) {
    const posAttr = this.particles.geometry.attributes.position;
    const positions = posAttr.array as Float32Array;

    const opacity = THREE.MathUtils.clamp((velocity - 20) / 40, 0, 1);
    (this.particles.material as THREE.PointsMaterial).opacity = opacity * 0.5;

    for (let i = 0; i < this.count; i++) {
      positions[i * 3 + 2] -= velocity * 0.1; // Move past player

      // If behind player, reset in front
      if (positions[i * 3 + 2] < playerPos.z - 20) {
        positions[i * 3] = playerPos.x + (Math.random() - 0.5) * 100;
        positions[i * 3 + 1] = playerPos.y + (Math.random() - 0.5) * 50;
        positions[i * 3 + 2] = playerPos.z + 100 + Math.random() * 50;
      }
    }
    posAttr.needsUpdate = true;
  }
}
