import * as THREE from 'three';

/**
 * SkyManager: The nocturnal Los Angeles sky.
 * Deep indigo overhead, warm amber sodium glow at the horizon.
 * References the visual palette of Drive (2011).
 */
export class SkyManager {
    private scene: THREE.Scene;
    private starField: THREE.Points;
    private moon: THREE.Mesh;
    private skyline: THREE.Mesh;
    private skyDome: THREE.Mesh;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Distant Starfield — sparse, slightly warm-tinted
        const starGeo = new THREE.BufferGeometry();
        const starPos = new Float32Array(400 * 3);
        for (let i = 0; i < 400; i++) {
            const i3 = i * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 0.9); // cluster near zenith
            const r = 4000;
            starPos[i3]     = r * Math.sin(phi) * Math.cos(theta);
            starPos[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            starPos[i3 + 2] = r * Math.cos(phi);
        }
        starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({
            color: 0xffd8a0,
            size: 2.2,
            transparent: true,
            opacity: 0.25,
            sizeAttenuation: false,
        });
        this.starField = new THREE.Points(starGeo, starMat);
        this.scene.add(this.starField);

        // 2. Moon — cool silver disc
        const moonGeo = new THREE.CircleGeometry(36, 32);
        const moonMat = new THREE.MeshBasicMaterial({
            color: 0xd0dcea,
            transparent: true,
            opacity: 0.55,
        });
        this.moon = new THREE.Mesh(moonGeo, moonMat);
        this.moon.position.set(50, 420, -1000);
        this.scene.add(this.moon);

        // 3. Sky dome — gradient from warm sodium at horizon to deep indigo overhead
        this.skyDome = this.createSkyDome();
        this.scene.add(this.skyDome);

        // 4. Procedural Skyline — LA silhouette with warm lit windows
        this.skyline = this.createSkyline();
        this.scene.add(this.skyline);
    }

    private createSkyDome(): THREE.Mesh {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 256;
        const ctx = canvas.getContext('2d')!;

        // Vertical gradient: indigo (top) → deep amber haze (horizon)
        const gradient = ctx.createLinearGradient(0, 0, 0, 256);
        gradient.addColorStop(0.0,  '#04020e'); // deep indigo zenith
        gradient.addColorStop(0.45, '#0c0608'); // dark mid
        gradient.addColorStop(0.75, '#1a0c03'); // amber bleed starts
        gradient.addColorStop(0.90, '#2e1205'); // sodium orange haze
        gradient.addColorStop(1.0,  '#3d1a08'); // warm horizon glow
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1, 256);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.repeat.set(1, 1);

        const geo = new THREE.SphereGeometry(3500, 16, 16);
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            side: THREE.BackSide,
            depthWrite: false,
        });
        return new THREE.Mesh(geo, mat);
    }

    private createSkyline(): THREE.Mesh {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 512;
        const ctx = canvas.getContext('2d')!;

        // Dark warm base
        ctx.fillStyle = '#040200';
        ctx.fillRect(0, 0, 2048, 512);

        // LA building silhouettes
        let x = 0;
        while (x < 2048) {
            const w = 35 + Math.random() * 90;
            const h = 60 + Math.random() * 350;
            ctx.fillStyle = '#060402';
            ctx.fillRect(x, 512 - h, w, h);

            // Warm sodium windows
            for (let i = 0; i < h / 22; i++) {
                for (let j = 0; j < w / 14; j++) {
                    if (Math.random() < 0.10) {
                        ctx.fillStyle = Math.random() < 0.7 ? '#ff9020' : '#ffcc55';
                        ctx.globalAlpha = 0.6 + Math.random() * 0.4;
                        ctx.fillRect(x + j * 14 + 3, 512 - h + i * 22 + 4, 7, 9);
                        ctx.globalAlpha = 1.0;
                    }
                }
            }
            x += w + 4 + Math.random() * 18;
        }

        const skylineTexture = new THREE.CanvasTexture(canvas);
        skylineTexture.wrapS = THREE.RepeatWrapping;

        const skylineMat = new THREE.MeshBasicMaterial({
            map: skylineTexture,
            transparent: true,
            side: THREE.BackSide,
            depthWrite: false,
        });

        const skylineGeo = new THREE.CylinderGeometry(2000, 2000, 380, 32, 1, true);
        const mesh = new THREE.Mesh(skylineGeo, skylineMat);
        mesh.position.y = 100;
        return mesh;
    }

    public update(carPos: THREE.Vector3): void {
        this.starField.position.copy(carPos);
        this.skyDome.position.copy(carPos);
        this.skyline.position.copy(carPos);
        this.skyline.position.y = 100;

        this.moon.position.x = carPos.x + 400;
        this.moon.position.y = 500;
        this.moon.position.z = carPos.z - 2000;
        this.moon.lookAt(carPos);
    }
}
