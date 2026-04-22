import * as THREE from 'three';

export class CityGenerator {
    private static buildingGeometry = new THREE.BoxGeometry(1, 1, 1);
    
    public static createBuilding(height: number, width: number, depth: number): THREE.Mesh {
        const material = new THREE.MeshStandardMaterial({
            color: 0x050505,
            roughness: 0.2,
            metalness: 0.8
        });
        
        const mesh = new THREE.Mesh(this.buildingGeometry, material);
        mesh.scale.set(width, height, depth);
        mesh.position.y = height / 2;
        
        // Neon windows
        const colors = [0x00ffff, 0xff00ff, 0xffff00, 0xff0000];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        const windows = new THREE.Mesh(
            new THREE.BoxGeometry(1.02, 0.1, 1.02),
            new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5
            })
        );
        windows.scale.set(width, 1, depth);

        for (let h = 0.2; h < 0.9; h += 0.15) {
            const floor = windows.clone();
            floor.position.y = (h - 0.5) * height;
            mesh.add(floor);
        }

        return mesh;
    }

    public static spawnCityRow(group: THREE.Group, zStart: number, zEnd: number, roadXFunc: (z: number) => number) {
        const spacing = 80;
        // IMPORTANT: roadX and z are world coords. group is at (chunkX, 0, chunkZ)
        // We need local coords relative to chunk center
        const chunkX = group.position.x;
        const chunkZ = group.position.z;

        for (let z = zStart; z < zEnd; z += spacing) {
            const roadX = roadXFunc(z);
            const side = Math.random() > 0.5 ? 1 : -1;
            const dist = 60 + Math.random() * 40;
            const height = 30 + Math.random() * 50;
            const width = 12 + Math.random() * 8;

            const b = this.createBuilding(height, width, width);
            // Convert world (roadX, z) to local (group relative)
            b.position.set(roadX + (side * dist) - chunkX, 0, z - chunkZ);
            group.add(b);
        }
    }
}
