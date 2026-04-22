import * as THREE from 'three';

export class Stars {
  public mesh: THREE.Points;

  constructor(scene: THREE.Scene, count: number = 2000) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Random position in a large sphere
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1000 + Math.random() * 500;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Random neon colors
      const color = new THREE.Color();
      const rand = Math.random();
      if (rand > 0.8) color.setHex(0x00f3ff); // Cyan
      else if (rand > 0.6) color.setHex(0xff00ff); // Magenta
      else color.setHex(0xffffff); // White

      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: false
    });

    this.mesh = new THREE.Points(geometry, material);
    scene.add(this.mesh);
  }

  public update(playerPosition: THREE.Vector3) {
    // Keep stars centered on player
    this.mesh.position.copy(playerPosition);
  }
}
