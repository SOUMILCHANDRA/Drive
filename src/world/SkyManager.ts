import * as THREE from 'three';

/**
 * SkyManager: Manages the celestial void, including the moon billboard and starfield.
 */
export class SkyManager {
    private scene: THREE.Scene;
    private starField: THREE.Points;
    private moon: THREE.Mesh;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Distant Starfield (200 tiny points)
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(200 * 3);
        for (let i = 0; i < 200; i++) {
            const i3 = i * 3;
            // Place stars in a huge hemisphere above the player
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random()); // Only upper half
            const r = 4000;
            starPos[i3] = r * Math.sin(phi) * Math.cos(theta);
            starPos[i3+1] = r * Math.sin(phi) * Math.sin(theta);
            starPos[i3+2] = r * Math.cos(phi);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.5,
            sizeAttenuation: false
        });
        this.starField = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starField);

        // 2. Moon Disc Billboard
        const moonGeo = new THREE.CircleGeometry(40, 32);
        const moonMat = new THREE.MeshBasicMaterial({
            color: 0xC8D4E8,
            transparent: true,
            opacity: 0.8
        });
        this.moon = new THREE.Mesh(moonGeo, moonMat);
        this.moon.position.set(50, 400, -1000);
        this.scene.add(this.moon);
    }

    public update(carPos: THREE.Vector3): void {
        // Starfield and Moon follow the player at infinity
        this.starField.position.copy(carPos);
        this.moon.position.x = carPos.x + 50;
        this.moon.position.y = 400;
        this.moon.position.z = carPos.z - 1000;
        
        // Face the camera
        this.moon.lookAt(carPos.clone().add(new THREE.Vector3(0, 0, 1)));
    }
}
