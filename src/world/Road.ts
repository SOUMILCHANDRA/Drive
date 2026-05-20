import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { NeonSign } from './NeonSign';
import type { QualityConfig } from '../core/QualitySettings';
import { BiomeManager } from './BiomeManager';
import type { BiomeParams } from './BiomeManager';

// Fixed-seed noise for deterministic terrain (same every load)
const noise2D = createNoise2D(() => 0.42);

/**
 * RoadChunk: A 500-unit segment of an LA scenic highway.
 * Follows a smooth 3D curve with rolling hills and winding bends.
 */
class RoadChunk {
    public mesh: THREE.Mesh;
    public lines: THREE.LineSegments;
    public cityGroup: THREE.Group;
    public neonSigns: NeonSign[] = [];
    public streetlightGlows: THREE.Vector3[] = [];
    public startZ: number = 0;
    public length: number = 500;
    public curve: THREE.CatmullRomCurve3;

    constructor(material: THREE.Material, lineMaterial: THREE.Material) {
        // Road surface — segments deformed to follow 3D curve
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(12, 500, 1, 50), material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = false;

        this.lines = new THREE.LineSegments(new THREE.BufferGeometry(), lineMaterial);
        this.curve = new THREE.CatmullRomCurve3();
        this.cityGroup = new THREE.Group();
    }

    public activate(startZ: number, points: THREE.Vector3[], scene: THREE.Scene, params: BiomeParams): void {
        this.startZ = startZ;
        this.curve = new THREE.CatmullRomCurve3(points);
        this.updateGeometry();
        this.generateCity(scene, params);
    }

    /** Deforms the flat road mesh to follow the 3D CatmullRom curve. */
    private updateGeometry(): void {
        const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
        const segments = 50;
        const width = 13;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const worldPos = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            // Left edge
            pos.setXYZ(i * 2,     worldPos.x - normal.x * (width / 2), worldPos.y, worldPos.z);
            // Right edge
            pos.setXYZ(i * 2 + 1, worldPos.x + normal.x * (width / 2), worldPos.y, worldPos.z);
        }
        pos.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();
        this.updateLines();
    }

    private updateLines(): void {
        const linePos: number[] = [];
        const segments = 100;
        for (let i = 0; i < segments; i++) {
            if (i % 5 === 0) continue; // Dashed centre line
            const p1 = this.curve.getPoint(i / segments);
            const p2 = this.curve.getPoint((i + 1) / segments);
            linePos.push(p1.x, p1.y + 0.05, p1.z, p2.x, p2.y + 0.05, p2.z);
        }
        this.lines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3));
    }

    private generateCity(scene: THREE.Scene, params: BiomeParams): void {
        this.cityGroup.clear();
        this.neonSigns = [];
        this.streetlightGlows = [];

        // Always generate terrain on both shoulders
        this.buildTerrainMesh(-1);
        this.buildTerrainMesh(1);

        if (params.name === 'TUNNEL') {
            this.generateTunnel();
            scene.add(this.cityGroup);
            return;
        }

        const segments = 22;
        for (let i = 0; i < segments; i++) {
            const t = i / segments;
            const worldPos = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            [1, -1].forEach(side => {
                // 1. Buildings (downtown / coast only)
                if (Math.random() < params.buildingDensity) {
                    const h = params.buildingHeight[0] + Math.random() * (params.buildingHeight[1] - params.buildingHeight[0]);
                    const w = 11 + Math.random() * 10;
                    const d = 14 + Math.random() * 10;
                    const building = this.createBuilding(w, h, d);
                    const bpos = worldPos.clone().add(normal.clone().multiplyScalar(side * (20 + Math.random() * 14)));
                    building.position.copy(bpos);
                    building.position.y = worldPos.y + h / 2;
                    building.lookAt(worldPos.clone().setY(building.position.y));
                    this.cityGroup.add(building);

                    if (Math.random() < params.neonDensity) {
                        const sign = new NeonSign();
                        sign.position.set(0, Math.random() * h / 3, d / 2 + 0.1);
                        building.add(sign);
                        this.neonSigns.push(sign);
                    }
                }

                // 2. Palm Trees (canyon / coast)
                if (params.hasPalms && i % 2 === 0 && Math.random() < 0.85) {
                    const palm = this.createPalmTree(9 + Math.random() * 6);
                    const ppos = worldPos.clone().add(normal.clone().multiplyScalar(side * (9 + Math.random() * 7)));
                    palm.position.copy(ppos);
                    palm.position.y = worldPos.y;
                    this.cityGroup.add(palm);
                }

                // 3. Retro LA Billboards (sparse)
                if (Math.random() < 0.055 && params.buildingDensity > 0.1) {
                    const billboard = this.createBillboard();
                    const blpos = worldPos.clone().add(normal.clone().multiplyScalar(side * (28 + Math.random() * 16)));
                    billboard.position.copy(blpos);
                    billboard.position.y = worldPos.y;
                    billboard.lookAt(worldPos.clone().setY(billboard.position.y + 8));
                    this.cityGroup.add(billboard);
                }

                // 4. Sodium Vapor Streetlights (rhythmic)
                if (i % 3 === 0) {
                    const streetlight = this.createStreetlight();
                    const slpos = worldPos.clone().add(normal.clone().multiplyScalar(side * 8));
                    streetlight.position.copy(slpos);
                    streetlight.position.y = worldPos.y;
                    streetlight.lookAt(worldPos.clone().setY(worldPos.y));
                    this.cityGroup.add(streetlight);

                    // Track glow position for PointLight pool
                    this.streetlightGlows.push(slpos.clone().add(new THREE.Vector3(0, 5.5, 0)));
                }
            });
        }
        scene.add(this.cityGroup);
    }

    /**
     * Builds a terrain mesh on one shoulder using Simplex noise.
     * Near the road, height is blended back to the road's elevation.
     */
    private buildTerrainMesh(side: number): void {
        const segZ = 22;
        const segX = 12;
        const terrainWidth = 130;
        const roadHalfWidth = 7;

        const positions: number[] = [];
        const indices: number[] = [];

        for (let iz = 0; iz <= segZ; iz++) {
            const t = iz / segZ;
            const cp = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            for (let ix = 0; ix <= segX; ix++) {
                const xDist = roadHalfWidth + (ix / segX) * terrainWidth;
                const basePos = cp.clone().add(normal.clone().multiplyScalar(side * xDist));

                // Layered noise for natural hillside feel
                const noiseH =
                    noise2D(basePos.x * 0.007,  basePos.z * 0.005)  * 45 +
                    noise2D(basePos.x * 0.018,  basePos.z * 0.014)  * 12 +
                    noise2D(basePos.x * 0.045,  basePos.z * 0.038)  * 4;

                // Blend: 0 at road shoulder, 1 at outer edge
                const blend = Math.min(1.0, Math.pow((xDist - roadHalfWidth) / 38, 1.4));
                const y = cp.y + noiseH * blend;

                positions.push(basePos.x, y, basePos.z);
            }
        }

        for (let iz = 0; iz < segZ; iz++) {
            for (let ix = 0; ix < segX; ix++) {
                const a = iz * (segX + 1) + ix;
                const b = a + 1;
                const c = (iz + 1) * (segX + 1) + ix;
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            color: 0x0e0b07,
            roughness: 0.94,
            metalness: 0.04,
        });

        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        this.cityGroup.add(mesh);
    }

    private generateTunnel(): void {
        const tunnelGeom = new THREE.CylinderGeometry(25, 25, 500, 16, 1, true, Math.PI, Math.PI);
        const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x050505, side: THREE.BackSide, roughness: 0.1 });
        const tunnel = new THREE.Mesh(tunnelGeom, tunnelMat);
        tunnel.rotation.z = Math.PI / 2;
        tunnel.position.set(0, 0, this.startZ + 250);
        this.cityGroup.add(tunnel);

        for (let i = 0; i < 6; i++) {
            const lightPos = new THREE.Vector3(0, 18, this.startZ + (i * 80) + 50);
            this.streetlightGlows.push(lightPos);
        }
    }

    public update(delta: number): void {
        this.neonSigns.forEach(s => s.update(delta));
    }

    // ─── Scenery Factories ────────────────────────────────────────────────

    private createBuilding(w: number, h: number, d: number): THREE.Group {
        const group = new THREE.Group();
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0c0a08, roughness: 0.9, metalness: 0.0 });
        group.add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat));

        // Warm sodium-tinted windows
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < 3; x++) {
                if (Math.random() > 0.42) {
                    const hue = Math.random() < 0.75 ? 0xff9030 : 0xffbb55; // sodium or halogen
                    const winMat = new THREE.MeshStandardMaterial({
                        color: 0x000000,
                        emissive: hue,
                        emissiveIntensity: 1.3,
                    });
                    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), winMat);
                    win.position.set(-w / 2 + 2 + x * w / 4, -h / 2 + 2 + y * h / 4, d / 2 + 0.1);
                    group.add(win);
                }
            }
        }
        return group;
    }

    /** Sodium-vapor streetlight — the signature amber-orange of LA nights. */
    private createStreetlight(): THREE.Group {
        const group = new THREE.Group();
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x252018, roughness: 0.85 });
        const lampMat = new THREE.MeshStandardMaterial({
            color: 0xff9200,
            emissive: 0xff9200,
            emissiveIntensity: 5.0,
            toneMapped: false,
        });

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.22, 6.5), poleMat);
        pole.position.y = 3.25;

        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.4), poleMat);
        arm.rotation.z = Math.PI / 2;
        arm.position.set(1.2, 6.5, 0);

        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), lampMat);
        lamp.position.set(2.4, 6.3, 0);

        group.add(pole, arm, lamp);
        return group;
    }

    /** Procedural palm tree — the defining silhouette of LA. */
    private createPalmTree(height: number): THREE.Group {
        const group = new THREE.Group();
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2a1c0e, roughness: 0.95 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.32, height, 7), trunkMat);
        trunk.position.y = height / 2;
        trunk.rotation.z = (Math.random() - 0.5) * 0.20; // natural lean
        group.add(trunk);

        const frondMat = new THREE.MeshStandardMaterial({ color: 0x1a2a0a, roughness: 0.95, side: THREE.DoubleSide });
        for (let i = 0; i < 8; i++) {
            const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3.8), frondMat);
            const angle = (i / 8) * Math.PI * 2;
            frond.position.set(Math.sin(angle) * 1.3, height - 0.5, Math.cos(angle) * 1.3);
            frond.rotation.y = -angle;
            frond.rotation.x = Math.PI / 3.0; // drooping downward
            group.add(frond);
        }
        return group;
    }

    /** Retro LA billboard with glowing sodium-colored text. */
    private createBillboard(): THREE.Group {
        const group = new THREE.Group();
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1510, roughness: 0.9 });
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 13, 6), poleMat);
        pole.position.y = 6.5;
        group.add(pole);

        const signs = ['DRIVE', 'NIGHTCALL', 'LA 1984', 'STANDARD', 'CHEVRON', 'BONAVENTURE', 'SUNSET'];
        const text = signs[Math.floor(Math.random() * signs.length)];

        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#0a0806';
        ctx.fillRect(0, 0, 512, 128);
        ctx.fillStyle = '#ff9200';
        ctx.font = 'bold 78px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 68);

        const tex = new THREE.CanvasTexture(canvas);
        const board = new THREE.Mesh(
            new THREE.PlaneGeometry(13, 3.2),
            new THREE.MeshStandardMaterial({
                map: tex,
                emissive: 0xff6600,
                emissiveIntensity: 0.45,
                emissiveMap: tex,
            })
        );
        board.position.y = 14;
        group.add(board);
        return group;
    }
}

// ─── Road Manager ─────────────────────────────────────────────────────────────

export class Road {
    private scene: THREE.Scene;
    private chunks: RoadChunk[] = [];
    private pool: RoadChunk[] = [];
    private waypoints: THREE.Vector3[] = [];
    private material: THREE.MeshStandardMaterial;
    private lineMaterial: THREE.Material;
    public biomeManager: BiomeManager;
    private streetlights: THREE.PointLight[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.biomeManager = new BiomeManager();

        // Wet dark asphalt — reflects the sodium glow
        this.material = new THREE.MeshStandardMaterial({
            color: 0x1e1a14,
            roughness: 0.18,
            metalness: 0.72,
            envMapIntensity: 1.8,
        });

        this.lineMaterial = new THREE.LineBasicMaterial({ color: 0xffcc66, transparent: true, opacity: 0.7 });

        // Sodium-orange PointLight pool for streetlight glow
        for (let i = 0; i < 10; i++) {
            const light = new THREE.PointLight(0xff9200, 3.5, 42, 2);
            this.streetlights.push(light);
            this.scene.add(light);
        }

        for (let i = 0; i < 22; i++) this.addWaypoint(i * 500);
        this.initPool();
        this.spawnInitialChunks();
    }

    /**
     * Deterministic 3D waypoint using smooth sine/cosine waves.
     * Creates the gentle winding curves and rolling hills of an LA scenic highway.
     */
    private addWaypoint(z: number): void {
        const x = Math.sin(z * 0.00042) * 65 + Math.cos(z * 0.00097) * 28;
        const y = Math.sin(z * 0.00055) * 22 + Math.cos(z * 0.00023) * 14;
        this.waypoints.push(new THREE.Vector3(x, y, z));
    }

    private initPool(): void {
        for (let i = 0; i < 12; i++) {
            this.pool.push(new RoadChunk(this.material, this.lineMaterial));
        }
    }

    private spawnInitialChunks(): void {
        for (let i = 0; i < 6; i++) {
            const z = i * 500;
            this.spawnChunk(z, this.biomeManager.getParamsAt(z));
        }
    }

    private ensureWaypointsFor(z: number): void {
        const wpIndex = Math.floor(z / 500);
        while (this.waypoints.length <= wpIndex + 4) {
            this.addWaypoint(this.waypoints.length * 500);
        }
    }

    private spawnChunk(z: number, params: BiomeParams): void {
        const chunk = this.pool.pop();
        if (!chunk) return;
        this.ensureWaypointsFor(z);
        const wpIndex = Math.floor(z / 500);
        const points = this.waypoints.slice(wpIndex, wpIndex + 4);
        chunk.activate(z, points, this.scene, params);
        this.scene.add(chunk.mesh, chunk.lines);
        this.chunks.push(chunk);
    }

    public getRoadPositionAt(z: number): { position: THREE.Vector3; tangent: THREE.Vector3 } {
        const safeZ = Math.max(0, z);
        this.ensureWaypointsFor(safeZ);
        const wpIndex = Math.max(0, Math.floor(safeZ / 500));
        const t = (safeZ % 500) / 500;
        const points = this.waypoints.slice(wpIndex, wpIndex + 4);
        if (points.length < 2) return { position: new THREE.Vector3(0, 0, safeZ), tangent: new THREE.Vector3(0, 0, 1) };
        const curve = new THREE.CatmullRomCurve3(points);
        return { position: curve.getPoint(t), tangent: curve.getTangent(t) };
    }

    public update(carZ: number, carPos: THREE.Vector3, _carSpeed: number, delta: number, config: QualityConfig): void {
        this.chunks.forEach(c => c.update(delta));

        // Assign nearest streetlight glows to the PointLight pool
        const allGlows = this.chunks.flatMap(c => c.streetlightGlows);
        allGlows.sort((a, b) => a.distanceToSquared(carPos) - b.distanceToSquared(carPos));

        this.streetlights.forEach((light, i) => {
            if (allGlows[i]) {
                light.position.copy(allGlows[i]);
                light.intensity = 3.5;
            } else {
                light.intensity = 0;
            }
        });

        const lookahead = config.chunkLimit * 500;
        if (this.chunks.length > 0 && carZ - this.chunks[0].startZ > 800) {
            const old = this.chunks.shift();
            if (old) {
                this.scene.remove(old.mesh, old.lines, old.cityGroup);
                this.pool.push(old);
            }
        }
        const lastChunk = this.chunks[this.chunks.length - 1];
        if (lastChunk.startZ - carZ < lookahead) {
            const nextZ = lastChunk.startZ + 500;
            this.spawnChunk(nextZ, this.biomeManager.getParamsAt(nextZ));
        }
    }

    public getRoadMeshes(): THREE.Object3D[] {
        return this.chunks.map(c => c.mesh);
    }
}
