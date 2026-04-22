import * as THREE from 'three';

export class CityGenerator {
    private static buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    private static buildingMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a0a0a,
        roughness: 0.1,
        metalness: 0.8
    });

    public static createBuilding(height: number, width: number, depth: number): THREE.Mesh {
        const mesh = new THREE.Mesh(this.buildingGeometry, this.buildingMaterial);
        mesh.scale.set(width, height, depth);
        mesh.position.y = height / 2;
        
        // Add neon windows (simplified)
        const windows = new THREE.Mesh(
            new THREE.BoxGeometry(1.01, 0.1, 1.01),
            new THREE.MeshStandardMaterial({
                color: 0x00ffff,
                emissive: 0x00ffff,
                emissiveIntensity: 0.8
            })
        );
        windows.scale.set(width, 1, depth);
        
        // Randomize neon color
        const colors = [0x00ffff, 0xff00ff, 0xffff00, 0xff0000];
        const color = colors[Math.floor(Math.random() * colors.length)];
        (windows.material as THREE.MeshStandardMaterial).color.setHex(color);
        (windows.material as THREE.MeshStandardMaterial).emissive.setHex(color);

        for (let h = 0.2; h < 0.9; h += 0.2) {
            const floor = windows.clone();
            floor.position.y = (h - 0.5) * height;
            mesh.add(floor);
        }

        return mesh;
    }

    public static spawnCityRow(group: THREE.Group, zStart: number, zEnd: number, roadXFunc: (z: number) => number) {
        const spacing = 40;
        for (let z = zStart; z < zEnd; z += spacing) {
            const roadX = roadXFunc(z);
            const side = Math.random() > 0.5 ? 1 : -1;
            const dist = 50 + Math.random() * 40; // Moved further away
            const height = 20 + Math.random() * 60; // Reduced height
            const width = 10 + Math.random() * 10;

            const b = this.createBuilding(height, width, width);
            b.position.set(roadX + side * dist, 0, z);
            group.add(b);
        }
    }
}
