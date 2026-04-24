import * as THREE from 'three';

/**
 * SkyManager: Manages the celestial void, including the moon, stars, and distant skyline.
 */
export class SkyManager {
    private scene: THREE.Scene;
    private starField: THREE.Points;
    private moon: THREE.Mesh;
    private skyline: THREE.Mesh;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Distant Starfield
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(300 * 3);
        for (let i = 0; i < 300; i++) {
            const i3 = i * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random()); 
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
            opacity: 0.3,
            sizeAttenuation: false
        });
        this.starField = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starField);

        // 2. Moon Billboard
        const moonGeo = new THREE.CircleGeometry(40, 32);
        const moonMat = new THREE.MeshBasicMaterial({
            color: 0xC8D4E8,
            transparent: true,
            opacity: 0.6
        });
        this.moon = new THREE.Mesh(moonGeo, moonMat);
        this.moon.position.set(50, 400, -1000);
        this.scene.add(this.moon);

        // 3. Procedural Skyline Silhouette
        this.skyline = this.createSkyline();
        this.scene.add(this.skyline);
    }

    private createSkyline(): THREE.Mesh {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;

        // Deep Void Background
        ctx.fillStyle = '#050508';
        ctx.fillRect(0, 0, 2048, 512);

        // Draw Building Silhouettes
        let x = 0;
        while (x < 2048) {
            const w = 40 + Math.random() * 80;
            const h = 80 + Math.random() * 320;
            
            // Building Body
            ctx.fillStyle = '#08080c';
            ctx.fillRect(x, 512 - h, w, h);
            
            // Random Lit Windows
            for (let i = 0; i < h / 25; i++) {
                for (let j = 0; j < w / 15; j++) {
                    if (Math.random() < 0.12) {
                        ctx.fillStyle = Math.random() < 0.6 ? '#ffcc66' : '#66aaff';
                        ctx.fillRect(x + j * 15 + 4, 512 - h + i * 25 + 4, 7, 9);
                    }
                }
            }
            x += w + 5 + Math.random() * 15;
        }

        const skylineTexture = new THREE.CanvasTexture(canvas);
        skylineTexture.wrapS = THREE.RepeatWrapping;
        
        const skylineMat = new THREE.MeshBasicMaterial({
            map: skylineTexture,
            transparent: true,
            side: THREE.BackSide, // Visible from inside the cylinder
            depthWrite: false,
        });

        const skylineGeo = new THREE.CylinderGeometry(2000, 2000, 400, 32, 1, true);
        const mesh = new THREE.Mesh(skylineGeo, skylineMat);
        mesh.position.y = 120;
        return mesh;
    }

    public update(carPos: THREE.Vector3): void {
        this.starField.position.copy(carPos);
        this.skyline.position.copy(carPos);
        this.skyline.position.y = 120;
        
        this.moon.position.x = carPos.x + 400;
        this.moon.position.y = 500;
        this.moon.position.z = carPos.z - 2000;
        this.moon.lookAt(carPos);
    }
}
