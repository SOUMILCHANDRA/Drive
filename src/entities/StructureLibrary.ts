import * as THREE from 'three';

export class StructureLibrary {
    public static createGasStation(): THREE.Group {
        const group = new THREE.Group();

        // Canopy
        const canopy = new THREE.Mesh(
            new THREE.BoxGeometry(20, 0.5, 12),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
        );
        canopy.position.y = 6;
        group.add(canopy);

        // Columns
        const colGeo = new THREE.BoxGeometry(0.5, 6, 0.5);
        const colMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        
        const positions = [[-8, 3, -4], [8, 3, -4], [-8, 3, 4], [8, 3, 4]];
        positions.forEach(p => {
            const col = new THREE.Mesh(colGeo, colMat);
            col.position.set(p[0], p[1], p[2]);
            group.add(col);
        });

        // Neon Signage
        const sign = new THREE.Mesh(
            new THREE.BoxGeometry(1, 4, 2),
            new THREE.MeshStandardMaterial({ 
                color: 0xff0000, 
                emissive: 0xff0000, 
                emissiveIntensity: 5 
            })
        );
        sign.position.set(-11, 4, 0);
        group.add(sign);

        return group;
    }

    public static createConstructionBarrier(): THREE.Group {
        const group = new THREE.Group();
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(4, 1, 0.2),
            new THREE.MeshStandardMaterial({ color: 0xffa500 })
        );
        mesh.position.y = 0.5;
        group.add(mesh);
        
        const light = new THREE.PointLight(0xffaa00, 1, 5);
        light.position.y = 1;
        group.add(light);
        
        return group;
    }
}
