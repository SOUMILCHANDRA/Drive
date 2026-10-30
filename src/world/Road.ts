import * as THREE from 'three';
import { BiomeManager, type BiomeParams } from './BiomeManager';
import { NeonSign } from './NeonSign';
import type { QualityConfig } from '../core/QualitySettings';

// ─── Procedural Fast Simplex Noise ───────────────────────────────────────────

const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

function noise2D(xin: number, yin: number): number {
    let s = (xin + yin) * F2;
    let i = Math.floor(xin + s);
    let j = Math.floor(yin + s);
    let t = (i + j) * G2;
    let X0 = i - t;
    let Y0 = j - t;
    let x0 = xin - X0;
    let y0 = yin - Y0;

    let i1 = x0 > y0 ? 1 : 0;
    let j1 = x0 > y0 ? 0 : 1;

    let x1 = x0 - i1 + G2;
    let y1 = y0 - j1 + G2;
    let x2 = x0 - 1.0 + 2.0 * G2;
    let y2 = y0 - 1.0 + 2.0 * G2;

    let n0 = 0, n1 = 0, n2 = 0;
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
        t0 *= t0;
        n0 = t0 * t0 * ((i * 12.9898 + j * 78.233) % 1.0 - 0.5);
    }
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
        t1 *= t1;
        n1 = t1 * t1 * (((i + i1) * 12.9898 + (j + j1) * 78.233) % 1.0 - 0.5);
    }
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
        t2 *= t2;
        n2 = t2 * t2 * (((i + 1) * 12.9898 + (j + 1) * 78.233) % 1.0 - 0.5);
    }
    return 70.0 * (n0 + n1 + n2);
}

// ─── Shared Highway Assets & Geometries ───────────────────────────────────────

const MAX_BUILDINGS = 50;
const MAX_WINDOWS = 520;
const MAX_STREETLIGHTS = 24;
const MAX_PALMS = 25;
const MAX_FRONDS = 150;
const MAX_GUARDRAILS = 80;
const MAX_STUDS = 45;

class SharedRoadAssets {
    // Terrain: Rich nocturnal California landscape (deep indigo/moss tones)
    public static terrainMaterial = new THREE.MeshStandardMaterial({
        color: 0x070e1c,
        roughness: 0.95,
        metalness: 0.02,
        flatShading: false,
    });

    // Streetlights
    public static poleMaterial = new THREE.MeshStandardMaterial({ color: 0x242838, roughness: 0.7, metalness: 0.5 });
    public static lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffa525, toneMapped: false });
    public static streetlightPoleGeo = new THREE.CylinderGeometry(0.09, 0.22, 7.5, 6);
    public static streetlightArmGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6);
    public static streetlightLampGeo = new THREE.SphereGeometry(0.28, 6, 5);

    // Highway Guardrails
    public static guardrailMat = new THREE.MeshStandardMaterial({ color: 0x484f64, roughness: 0.45, metalness: 0.7 });
    public static reflectorRedMat = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
    public static reflectorWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf5f8ff, toneMapped: false });
    public static guardrailPostGeo = new THREE.BoxGeometry(0.14, 0.95, 0.14);
    public static guardrailBeamGeo = new THREE.BoxGeometry(0.08, 0.36, 12.6);
    public static reflectorGeo = new THREE.BoxGeometry(0.06, 0.14, 0.14);

    // Road Studs (Cat's Eyes)
    public static studMat = new THREE.MeshBasicMaterial({ color: 0xffb830, toneMapped: false });
    public static studGeo = new THREE.BoxGeometry(0.16, 0.06, 0.24);

    // Palms
    public static palmTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x281a10, roughness: 0.95 });
    public static palmFrondMaterial = new THREE.MeshStandardMaterial({ color: 0x142208, roughness: 0.95, side: THREE.DoubleSide });
    public static palmTrunkGeo = new THREE.CylinderGeometry(0.14, 0.32, 11.5, 6);
    public static palmFrondGeo = new THREE.PlaneGeometry(0.55, 4.2);

    // Freeway Overpass & Gantries
    public static overpassMat = new THREE.MeshStandardMaterial({ color: 0x1e2433, roughness: 0.85, metalness: 0.2 });
    public static overpassGeo = new THREE.BoxGeometry(18, 1.4, 8);
    public static gantrySignMat = new THREE.MeshBasicMaterial({ color: 0x006633 });
    public static gantrySignGeo = new THREE.PlaneGeometry(6.5, 2.2);

    // Buildings & Windows
    public static buildingBodyMat = new THREE.MeshStandardMaterial({ color: 0x080c16, roughness: 0.88, metalness: 0.12 });
    public static windowMatAmber = new THREE.MeshBasicMaterial({ color: 0xff9933, toneMapped: false });
    public static windowMatGold = new THREE.MeshBasicMaterial({ color: 0xffc855, toneMapped: false });
    public static windowMatCyan = new THREE.MeshBasicMaterial({ color: 0x44ddff, toneMapped: false });
    public static windowGeo = new THREE.PlaneGeometry(0.65, 0.75);

    // Tunnel Arches
    public static archGeo = new THREE.TorusGeometry(14, 1.4, 8, 16, Math.PI);
    public static archMat = new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.85 });

    // Billboards
    public static billboardPoleGeo = new THREE.CylinderGeometry(0.2, 0.32, 14, 6);
    public static billboardBoardGeo = new THREE.PlaneGeometry(13, 3.4);
    private static billboardTextures: THREE.CanvasTexture[] = [];

    public static getBillboardTexture(index: number): THREE.CanvasTexture {
        if (this.billboardTextures.length === 0) {
            const signs = ['DRIVE', 'NIGHTCALL', 'HOLLYWOOD', 'PACIFIC COAST', 'CHEVRON', 'BONAVENTURE', 'SUNSET BLVD'];
            signs.forEach(text => {
                const canvas = document.createElement('canvas');
                canvas.width = 512;
                canvas.height = 128;
                const ctx = canvas.getContext('2d')!;
                ctx.fillStyle = '#0a0d16';
                ctx.fillRect(0, 0, 512, 128);
                ctx.fillStyle = '#ff9514';
                ctx.font = 'bold 52px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 256, 64);
                const tex = new THREE.CanvasTexture(canvas);
                this.billboardTextures.push(tex);
            });
        }
        return this.billboardTextures[index % this.billboardTextures.length];
    }
}

// ─── RoadChunk: High Fidelity Highway Section ────────────────────────────────

const SEG_X = 24;
const SEG_Z = 36;

class RoadChunk {
    public mesh: THREE.Mesh;
    public yellowLines: THREE.LineSegments;
    public whiteLines: THREE.LineSegments;
    public cityGroup: THREE.Group;
    public neonSigns: NeonSign[] = [];
    public streetlightGlows: THREE.Vector3[] = [];
    public startZ: number = 0;
    public length: number = 500;
    public curve: THREE.CatmullRomCurve3;

    // Terrain
    private leftTerrainMesh: THREE.Mesh;
    private rightTerrainMesh: THREE.Mesh;

    // Instanced highway meshes
    private buildingMesh: THREE.InstancedMesh;
    private windowAmberMesh: THREE.InstancedMesh;
    private windowGoldMesh: THREE.InstancedMesh;
    private windowCyanMesh: THREE.InstancedMesh;
    private streetPolesMesh: THREE.InstancedMesh;
    private streetArmsMesh: THREE.InstancedMesh;
    private streetLampsMesh: THREE.InstancedMesh;
    private palmTrunksMesh: THREE.InstancedMesh;
    private palmFrondsMesh: THREE.InstancedMesh;
    private tunnelArchesMesh: THREE.InstancedMesh;
    private guardrailPostsMesh: THREE.InstancedMesh;
    private guardrailBeamsMesh: THREE.InstancedMesh;
    private guardrailReflectorsMesh: THREE.InstancedMesh;
    private roadStudsMesh: THREE.InstancedMesh;
    private overpassMesh: THREE.InstancedMesh;
    private billboardsGroup: THREE.Group;

    private dummy = new THREE.Object3D();

    constructor(roadMaterial: THREE.Material, yellowMat: THREE.Material, whiteMat: THREE.Material) {
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 500, 1, 40), roadMaterial);
        this.mesh.receiveShadow = true;

        this.yellowLines = new THREE.LineSegments(new THREE.BufferGeometry(), yellowMat);
        this.whiteLines = new THREE.LineSegments(new THREE.BufferGeometry(), whiteMat);
        this.curve = new THREE.CatmullRomCurve3();
        this.cityGroup = new THREE.Group();

        // 1. Terrain Meshes
        this.leftTerrainMesh = this.initTerrainMesh();
        this.rightTerrainMesh = this.initTerrainMesh();
        this.cityGroup.add(this.leftTerrainMesh);
        this.cityGroup.add(this.rightTerrainMesh);

        // 2. Instanced Highway Meshes
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        this.buildingMesh = new THREE.InstancedMesh(boxGeo, SharedRoadAssets.buildingBodyMat, MAX_BUILDINGS);
        this.windowAmberMesh = new THREE.InstancedMesh(SharedRoadAssets.windowGeo, SharedRoadAssets.windowMatAmber, MAX_WINDOWS);
        this.windowGoldMesh = new THREE.InstancedMesh(SharedRoadAssets.windowGeo, SharedRoadAssets.windowMatGold, MAX_WINDOWS);
        this.windowCyanMesh = new THREE.InstancedMesh(SharedRoadAssets.windowGeo, SharedRoadAssets.windowMatCyan, MAX_WINDOWS);

        this.streetPolesMesh = new THREE.InstancedMesh(SharedRoadAssets.streetlightPoleGeo, SharedRoadAssets.poleMaterial, MAX_STREETLIGHTS);
        this.streetArmsMesh = new THREE.InstancedMesh(SharedRoadAssets.streetlightArmGeo, SharedRoadAssets.poleMaterial, MAX_STREETLIGHTS);
        this.streetLampsMesh = new THREE.InstancedMesh(SharedRoadAssets.streetlightLampGeo, SharedRoadAssets.lampMaterial, MAX_STREETLIGHTS);

        this.palmTrunksMesh = new THREE.InstancedMesh(SharedRoadAssets.palmTrunkGeo, SharedRoadAssets.palmTrunkMaterial, MAX_PALMS);
        this.palmFrondsMesh = new THREE.InstancedMesh(SharedRoadAssets.palmFrondGeo, SharedRoadAssets.palmFrondMaterial, MAX_FRONDS);
        this.tunnelArchesMesh = new THREE.InstancedMesh(SharedRoadAssets.archGeo, SharedRoadAssets.archMat, 16);

        this.guardrailPostsMesh = new THREE.InstancedMesh(SharedRoadAssets.guardrailPostGeo, SharedRoadAssets.guardrailMat, MAX_GUARDRAILS);
        this.guardrailBeamsMesh = new THREE.InstancedMesh(SharedRoadAssets.guardrailBeamGeo, SharedRoadAssets.guardrailMat, MAX_GUARDRAILS);
        this.guardrailReflectorsMesh = new THREE.InstancedMesh(SharedRoadAssets.reflectorGeo, SharedRoadAssets.reflectorRedMat, MAX_GUARDRAILS);
        this.roadStudsMesh = new THREE.InstancedMesh(SharedRoadAssets.studGeo, SharedRoadAssets.studMat, MAX_STUDS);
        this.overpassMesh = new THREE.InstancedMesh(SharedRoadAssets.overpassGeo, SharedRoadAssets.overpassMat, 4);

        this.billboardsGroup = new THREE.Group();

        this.cityGroup.add(
            this.buildingMesh,
            this.windowAmberMesh,
            this.windowGoldMesh,
            this.windowCyanMesh,
            this.streetPolesMesh,
            this.streetArmsMesh,
            this.streetLampsMesh,
            this.palmTrunksMesh,
            this.palmFrondsMesh,
            this.tunnelArchesMesh,
            this.guardrailPostsMesh,
            this.guardrailBeamsMesh,
            this.guardrailReflectorsMesh,
            this.roadStudsMesh,
            this.overpassMesh,
            this.billboardsGroup
        );
    }

    private initTerrainMesh(): THREE.Mesh {
        const vertexCount = (SEG_X + 1) * (SEG_Z + 1);
        const positions = new Float32Array(vertexCount * 3);
        const indices: number[] = [];

        for (let iz = 0; iz < SEG_Z; iz++) {
            for (let ix = 0; ix < SEG_X; ix++) {
                const a = iz * (SEG_X + 1) + ix;
                const b = a + 1;
                const c = (iz + 1) * (SEG_X + 1) + ix;
                const d = c + 1;
                indices.push(a, c, b, b, c, d);
            }
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setIndex(indices);

        const mesh = new THREE.Mesh(geo, SharedRoadAssets.terrainMaterial);
        mesh.receiveShadow = true;
        return mesh;
    }

    public activate(startZ: number, points: THREE.Vector3[], scene: THREE.Scene, params: BiomeParams): void {
        this.startZ = startZ;
        this.curve = new THREE.CatmullRomCurve3(points);
        this.updateGeometry();
        this.generateCity(scene, params);
    }

    private updateGeometry(): void {
        const pos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
        const segments = 40;
        const width = 14;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const worldPos = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            pos.setXYZ(i * 2,     worldPos.x + normal.x * (width / 2), worldPos.y, worldPos.z);
            pos.setXYZ(i * 2 + 1, worldPos.x - normal.x * (width / 2), worldPos.y, worldPos.z);
        }
        pos.needsUpdate = true;
        this.mesh.geometry.computeVertexNormals();
        this.updateMarkings();
    }

    private updateMarkings(): void {
        const yellowPos: number[] = [];
        const whitePos: number[] = [];
        const segments = 90;

        for (let i = 0; i < segments; i++) {
            const t1 = i / segments;
            const t2 = (i + 1) / segments;
            const p1 = this.curve.getPoint(t1);
            const p2 = this.curve.getPoint(t2);
            const tan1 = this.curve.getTangent(t1);
            const norm1 = new THREE.Vector3(-tan1.z, 0, tan1.x).normalize();
            const tan2 = this.curve.getTangent(t2);
            const norm2 = new THREE.Vector3(-tan2.z, 0, tan2.x).normalize();

            // 1. Double Solid Yellow Center Divider Lines
            [-0.18, 0.18].forEach(offset => {
                yellowPos.push(
                    p1.x + norm1.x * offset, p1.y + 0.018, p1.z + norm1.z * offset,
                    p2.x + norm2.x * offset, p2.y + 0.018, p2.z + norm2.z * offset
                );
            });

            // 2. Outer Shoulder Fog Lines (Solid White)
            [-6.4, 6.4].forEach(offset => {
                whitePos.push(
                    p1.x + norm1.x * offset, p1.y + 0.018, p1.z + norm1.z * offset,
                    p2.x + norm2.x * offset, p2.y + 0.018, p2.z + norm2.z * offset
                );
            });

            // 3. Dashed White Lane Dividers
            if (i % 5 < 3) {
                [-3.2, 3.2].forEach(offset => {
                    whitePos.push(
                        p1.x + norm1.x * offset, p1.y + 0.018, p1.z + norm1.z * offset,
                        p2.x + norm2.x * offset, p2.y + 0.018, p2.z + norm2.z * offset
                    );
                });
            }
        }

        this.yellowLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(yellowPos, 3));
        this.whiteLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(whitePos, 3));
    }

    private generateCity(scene: THREE.Scene, params: BiomeParams): void {
        while (this.billboardsGroup.children.length > 0) {
            this.billboardsGroup.remove(this.billboardsGroup.children[0]);
        }
        for (let i = 0; i < this.neonSigns.length; i++) {
            this.cityGroup.remove(this.neonSigns[i]);
            this.neonSigns[i].dispose();
        }
        this.neonSigns = [];
        this.streetlightGlows = [];

        // 1. Update Seamless Continuous Rolling Terrain (460m width each side)
        this.updateTerrainMesh(this.leftTerrainMesh, -1);
        this.updateTerrainMesh(this.rightTerrainMesh, 1);

        let buildingCount = 0;
        let amberWinCount = 0;
        let goldWinCount = 0;
        let cyanWinCount = 0;
        let streetCount = 0;
        let palmCount = 0;
        let frondCount = 0;
        let guardrailCount = 0;
        let studCount = 0;
        let overpassCount = 0;

        // 2. Road Studs along Double Yellow Divider
        const studSteps = 35;
        for (let i = 0; i < studSteps; i++) {
            if (studCount < MAX_STUDS) {
                const t = (i + 0.5) / studSteps;
                const pt = this.curve.getPoint(t);
                const tangent = this.curve.getTangent(t);
                this.dummy.position.set(pt.x, pt.y + 0.03, pt.z);
                this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                this.dummy.scale.set(1, 1, 1);
                this.dummy.updateMatrix();
                this.roadStudsMesh.setMatrixAt(studCount++, this.dummy.matrix);
            }
        }

        // 3. Highway Guardrails along Both Edges
        const railSteps = 38;
        for (let i = 0; i < railSteps; i++) {
            const t = i / railSteps;
            const pt = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            for (const side of [1, -1]) {
                if (guardrailCount < MAX_GUARDRAILS) {
                    const postPos = pt.clone().add(normal.clone().multiplyScalar(side * 6.9));
                    postPos.y = pt.y + 0.48;

                    // Post
                    this.dummy.position.copy(postPos);
                    this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                    this.dummy.scale.set(1, 1, 1);
                    this.dummy.updateMatrix();
                    this.guardrailPostsMesh.setMatrixAt(guardrailCount, this.dummy.matrix);

                    // Reflector on post
                    this.dummy.position.set(postPos.x - side * 0.08, postPos.y + 0.35, postPos.z);
                    this.dummy.updateMatrix();
                    this.guardrailReflectorsMesh.setMatrixAt(guardrailCount, this.dummy.matrix);

                    // Horizontal Rail Beam
                    if (i % 2 === 0) {
                        this.dummy.position.set(postPos.x, postPos.y + 0.25, postPos.z);
                        this.dummy.updateMatrix();
                        this.guardrailBeamsMesh.setMatrixAt(guardrailCount / 2, this.dummy.matrix);
                    }

                    guardrailCount++;
                }
            }
        }

        // 4. Highway Overpasses
        if (params.name !== 'TUNNEL' && Math.random() < 0.35 && overpassCount < 2) {
            const t = 0.5;
            const pt = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            this.dummy.position.set(pt.x, pt.y + 7.5, pt.z);
            this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
            this.dummy.rotation.y += Math.PI / 2;
            this.dummy.scale.set(1, 1, 1);
            this.dummy.updateMatrix();
            this.overpassMesh.setMatrixAt(overpassCount++, this.dummy.matrix);
        }

        // 5. Tunnel Arch Check
        if (params.name === 'TUNNEL') {
            const archCount = 14;
            for (let i = 0; i < archCount; i++) {
                const t = (i + 0.5) / archCount;
                const pt = this.curve.getPoint(t);
                const tangent = this.curve.getTangent(t);

                this.dummy.position.copy(pt);
                this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                this.dummy.scale.set(1, 1, 1);
                this.dummy.updateMatrix();
                this.tunnelArchesMesh.setMatrixAt(i, this.dummy.matrix);

                const lightPos = pt.clone().add(new THREE.Vector3(0, 8.5, 0));
                this.streetlightGlows.push(lightPos);
            }
            this.tunnelArchesMesh.count = archCount;
            this.tunnelArchesMesh.instanceMatrix.needsUpdate = true;
            this.applyMeshCounts(buildingCount, amberWinCount, goldWinCount, cyanWinCount, streetCount, palmCount, frondCount, guardrailCount, studCount, overpassCount);
            scene.add(this.cityGroup);
            return;
        } else {
            this.tunnelArchesMesh.count = 0;
        }

        // 6. Roadside Architecture & Nature (Set back gracefully from highway)
        const segments = 22;
        for (let i = 0; i < segments; i++) {
            const t = i / segments;
            const worldPos = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            for (const side of [1, -1]) {
                // Instanced Buildings (Set back 130m - 240m forming a majestic city skyline)
                if (Math.random() < params.buildingDensity * 0.7 && buildingCount < MAX_BUILDINGS) {
                    const h = params.buildingHeight[0] + Math.random() * (params.buildingHeight[1] - params.buildingHeight[0]);
                    const w = 24 + Math.random() * 20;
                    const d = 24 + Math.random() * 20;
                    const setback = 130 + Math.random() * 110;
                    const bpos = worldPos.clone().add(normal.clone().multiplyScalar(side * setback));
                    bpos.y = worldPos.y + h / 2 - 2.0;

                    this.dummy.position.copy(bpos);
                    this.dummy.scale.set(w, h, d);
                    this.dummy.lookAt(worldPos.clone().setY(bpos.y));
                    this.dummy.updateMatrix();
                    this.buildingMesh.setMatrixAt(buildingCount, this.dummy.matrix);

                    // Dense Illuminated Window Grids across Facade
                    const bQuat = this.dummy.quaternion.clone();
                    for (let y = 0; y < 6; y++) {
                        for (let x = 0; x < 4; x++) {
                            if (Math.random() > 0.28) {
                                const localWinPos = new THREE.Vector3(
                                    -w / 2 + 2.5 + x * (w / 4.2),
                                    -h / 2 + 3.0 + y * (h / 6.5),
                                    d / 2 + 0.08
                                ).applyQuaternion(bQuat).add(bpos);

                                this.dummy.position.copy(localWinPos);
                                this.dummy.quaternion.copy(bQuat);
                                this.dummy.scale.set(1.1, 1.1, 1);
                                this.dummy.updateMatrix();

                                const r = Math.random();
                                if (r < 0.50 && amberWinCount < MAX_WINDOWS) {
                                    this.windowAmberMesh.setMatrixAt(amberWinCount++, this.dummy.matrix);
                                } else if (r < 0.80 && goldWinCount < MAX_WINDOWS) {
                                    this.windowGoldMesh.setMatrixAt(goldWinCount++, this.dummy.matrix);
                                } else if (cyanWinCount < MAX_WINDOWS) {
                                    this.windowCyanMesh.setMatrixAt(cyanWinCount++, this.dummy.matrix);
                                }
                            }
                        }
                    }

                    // Neon Sign on Rooftop or Upper Facade
                    if (Math.random() < params.neonDensity && this.neonSigns.length < 5) {
                        const sign = new NeonSign();
                        const signOffset = new THREE.Vector3(0, h / 2 - 1.2, d / 2 + 0.25).applyQuaternion(bQuat);
                        sign.position.copy(bpos).add(signOffset);
                        sign.quaternion.copy(bQuat);
                        this.cityGroup.add(sign);
                        this.neonSigns.push(sign);
                    }

                    buildingCount++;
                }

                // Roadside California Palms (At highway verge x = 9m - 14m)
                if (params.hasPalms && i % 2 === 0 && Math.random() < 0.8 && palmCount < MAX_PALMS) {
                    const ppos = worldPos.clone().add(normal.clone().multiplyScalar(side * (10 + Math.random() * 4)));
                    ppos.y = worldPos.y - 0.2;

                    this.dummy.position.set(ppos.x, ppos.y + 5.7, ppos.z);
                    this.dummy.rotation.set(0, 0, (Math.random() - 0.5) * 0.12);
                    this.dummy.scale.set(1, 1, 1);
                    this.dummy.updateMatrix();
                    this.palmTrunksMesh.setMatrixAt(palmCount++, this.dummy.matrix);

                    for (let f = 0; f < 6; f++) {
                        if (frondCount < MAX_FRONDS) {
                            const angle = (f / 6) * Math.PI * 2;
                            this.dummy.position.set(
                                ppos.x + Math.sin(angle) * 1.3,
                                ppos.y + 11.2,
                                ppos.z + Math.cos(angle) * 1.3
                            );
                            this.dummy.rotation.set(Math.PI / 3.2, -angle, 0);
                            this.dummy.scale.set(1, 1, 1);
                            this.dummy.updateMatrix();
                            this.palmFrondsMesh.setMatrixAt(frondCount++, this.dummy.matrix);
                        }
                    }
                }

                // Billboards (Set back 28m - 38m)
                if (Math.random() < 0.06 && params.buildingDensity > 0.1 && this.billboardsGroup.children.length < 2) {
                    const billboard = this.createBillboard();
                    const blpos = worldPos.clone().add(normal.clone().multiplyScalar(side * (32 + Math.random() * 10)));
                    billboard.position.copy(blpos);
                    billboard.position.y = worldPos.y;
                    billboard.lookAt(worldPos.clone().setY(billboard.position.y + 7));
                    this.billboardsGroup.add(billboard);
                }

                // Highway Streetlights
                if (i % 3 === 0 && streetCount < MAX_STREETLIGHTS) {
                    const slpos = worldPos.clone().add(normal.clone().multiplyScalar(side * 8.2));
                    slpos.y = worldPos.y;

                    // Pole
                    this.dummy.position.set(slpos.x, slpos.y + 3.75, slpos.z);
                    this.dummy.rotation.set(0, 0, 0);
                    this.dummy.scale.set(1, 1, 1);
                    this.dummy.updateMatrix();
                    this.streetPolesMesh.setMatrixAt(streetCount, this.dummy.matrix);

                    // Overhanging Arm
                    this.dummy.position.set(slpos.x + side * 1.3, slpos.y + 7.4, slpos.z);
                    this.dummy.rotation.set(0, 0, side * Math.PI / 2);
                    this.dummy.updateMatrix();
                    this.streetArmsMesh.setMatrixAt(streetCount, this.dummy.matrix);

                    // Sodium Luminaire
                    this.dummy.position.set(slpos.x + side * 2.5, slpos.y + 7.2, slpos.z);
                    this.dummy.rotation.set(0, 0, 0);
                    this.dummy.updateMatrix();
                    this.streetLampsMesh.setMatrixAt(streetCount, this.dummy.matrix);

                    this.streetlightGlows.push(new THREE.Vector3(slpos.x + side * 2.5, slpos.y + 7.2, slpos.z));
                    streetCount++;
                }
            }
        }

        this.applyMeshCounts(buildingCount, amberWinCount, goldWinCount, cyanWinCount, streetCount, palmCount, frondCount, guardrailCount, studCount, overpassCount);
        scene.add(this.cityGroup);
    }

    private applyMeshCounts(bCount: number, aWin: number, gWin: number, cWin: number, sCount: number, pCount: number, fCount: number, gRail: number, stud: number, over: number): void {
        this.buildingMesh.count = bCount;
        this.buildingMesh.instanceMatrix.needsUpdate = true;

        this.windowAmberMesh.count = aWin;
        this.windowAmberMesh.instanceMatrix.needsUpdate = true;

        this.windowGoldMesh.count = gWin;
        this.windowGoldMesh.instanceMatrix.needsUpdate = true;

        this.windowCyanMesh.count = cWin;
        this.windowCyanMesh.instanceMatrix.needsUpdate = true;

        this.streetPolesMesh.count = sCount;
        this.streetPolesMesh.instanceMatrix.needsUpdate = true;

        this.streetArmsMesh.count = sCount;
        this.streetArmsMesh.instanceMatrix.needsUpdate = true;

        this.streetLampsMesh.count = sCount;
        this.streetLampsMesh.instanceMatrix.needsUpdate = true;

        this.palmTrunksMesh.count = pCount;
        this.palmTrunksMesh.instanceMatrix.needsUpdate = true;

        this.palmFrondsMesh.count = fCount;
        this.palmFrondsMesh.instanceMatrix.needsUpdate = true;

        this.guardrailPostsMesh.count = gRail;
        this.guardrailPostsMesh.instanceMatrix.needsUpdate = true;

        this.guardrailBeamsMesh.count = Math.floor(gRail / 2);
        this.guardrailBeamsMesh.instanceMatrix.needsUpdate = true;

        this.guardrailReflectorsMesh.count = gRail;
        this.guardrailReflectorsMesh.instanceMatrix.needsUpdate = true;

        this.roadStudsMesh.count = stud;
        this.roadStudsMesh.instanceMatrix.needsUpdate = true;

        this.overpassMesh.count = over;
        this.overpassMesh.instanceMatrix.needsUpdate = true;
    }

    private updateTerrainMesh(mesh: THREE.Mesh, side: number): void {
        const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;
        const terrainStart = 7.4;
        const terrainWidth = 460;
        let idx = 0;

        for (let iz = 0; iz <= SEG_Z; iz++) {
            const t = iz / SEG_Z;
            const cp = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            for (let ix = 0; ix <= SEG_X; ix++) {
                const u = ix / SEG_X;
                const xDist = terrainStart + u * terrainWidth;
                const bx = cp.x + normal.x * (side * xDist);
                const bz = cp.z + normal.z * (side * xDist);

                // Multi-octave natural rolling hills (Slow Roads aesthetic)
                const hillLow = noise2D(bx * 0.0035, bz * 0.0025) * 58;
                const hillMid = noise2D(bx * 0.012, bz * 0.009) * 16;
                const hillHigh = noise2D(bx * 0.03, bz * 0.02) * 4.5;
                const totalHill = hillLow + hillMid + hillHigh;

                // Close to road (u < 0.12): gentle ditch/shoulder dropping slightly below road
                // Medium & far: rolling hillside rising naturally
                const blend = Math.pow(Math.min(1.0, u / 0.16), 1.5);
                // At far edge (u > 0.75), softly taper down into horizon fog
                const taper = Math.cos(Math.max(0.0, (u - 0.75) / 0.25) * (Math.PI / 2));
                const by = cp.y - 0.32 + (totalHill * blend * taper);

                positions[idx++] = bx;
                positions[idx++] = by;
                positions[idx++] = bz;
            }
        }

        posAttr.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
    }

    public update(delta: number): void {
        for (let i = 0; i < this.neonSigns.length; i++) {
            this.neonSigns[i].update(delta);
        }
    }

    private createBillboard(): THREE.Group {
        const group = new THREE.Group();
        const pole = new THREE.Mesh(SharedRoadAssets.billboardPoleGeo, SharedRoadAssets.poleMaterial);
        pole.position.y = 7.0;
        group.add(pole);

        const texIndex = Math.floor(Math.random() * 7);
        const tex = SharedRoadAssets.getBillboardTexture(texIndex);
        const boardMat = new THREE.MeshBasicMaterial({ map: tex });
        const board = new THREE.Mesh(SharedRoadAssets.billboardBoardGeo, boardMat);
        board.position.y = 14;
        group.add(board);
        return group;
    }

    public dispose(): void {
        this.mesh.geometry.dispose();
        this.yellowLines.geometry.dispose();
        this.whiteLines.geometry.dispose();
        this.leftTerrainMesh.geometry.dispose();
        this.rightTerrainMesh.geometry.dispose();
        this.buildingMesh.dispose();
        this.windowAmberMesh.dispose();
        this.windowGoldMesh.dispose();
        this.windowCyanMesh.dispose();
        this.streetPolesMesh.dispose();
        this.streetArmsMesh.dispose();
        this.streetLampsMesh.dispose();
        this.palmTrunksMesh.dispose();
        this.palmFrondsMesh.dispose();
        this.tunnelArchesMesh.dispose();
        this.guardrailPostsMesh.dispose();
        this.guardrailBeamsMesh.dispose();
        this.guardrailReflectorsMesh.dispose();
        this.roadStudsMesh.dispose();
        this.overpassMesh.dispose();
    }
}

// ─── Road Manager ─────────────────────────────────────────────────────────────

export class Road {
    private scene: THREE.Scene;
    private chunks: RoadChunk[] = [];
    private pool: RoadChunk[] = [];
    private waypoints: THREE.Vector3[] = [];
    private material: THREE.MeshStandardMaterial;
    private yellowLineMat: THREE.Material;
    private whiteLineMat: THREE.Material;
    public biomeManager: BiomeManager;
    private streetlights: THREE.PointLight[] = [];
    private neonLights: THREE.PointLight[] = [];

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.biomeManager = new BiomeManager();

        // Sleek wet asphalt highway surface
        this.material = new THREE.MeshStandardMaterial({
            color: 0x181c26,
            roughness: 0.32,
            metalness: 0.45,
            side: THREE.DoubleSide,
            envMapIntensity: 1.8,
        });

        // Double yellow divider lines
        this.yellowLineMat = new THREE.LineBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1.5,
            polygonOffsetUnits: -1.5,
        });

        // Crisp white fog & dashed lane lines
        this.whiteLineMat = new THREE.LineBasicMaterial({
            color: 0xdde4f5,
            transparent: true,
            opacity: 0.90,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1.5,
            polygonOffsetUnits: -1.5,
        });

        // Streetlights pool
        for (let i = 0; i < 4; i++) {
            const light = new THREE.PointLight(0xffa022, 2.8, 38, 2);
            light.castShadow = false;
            this.streetlights.push(light);
            this.scene.add(light);
        }

        // Shared dynamic neon PointLights
        for (let i = 0; i < 2; i++) {
            const light = new THREE.PointLight(0xff2d78, 0, 32, 2);
            light.castShadow = false;
            this.neonLights.push(light);
            this.scene.add(light);
        }

        for (let i = 0; i < 18; i++) this.addWaypoint(i * 500);
        this.initPool();
        this.spawnInitialChunks();
    }

    private addWaypoint(z: number): void {
        // Natural sweeping highway curves with gentle elevation hills starting at origin
        const x = Math.sin(z * 0.00038) * 75 + (Math.cos(z * 0.00085) - 1.0) * 32;
        const y = Math.sin(z * 0.00048) * 16 + (Math.cos(z * 0.00022) - 1.0) * 10;
        this.waypoints.push(new THREE.Vector3(x, y, z));
    }

    private initPool(): void {
        for (let i = 0; i < 8; i++) {
            this.pool.push(new RoadChunk(this.material, this.yellowLineMat, this.whiteLineMat));
        }
    }

    private spawnInitialChunks(): void {
        for (let i = 0; i < 5; i++) {
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
        const chunk = this.pool.pop() || new RoadChunk(this.material, this.yellowLineMat, this.whiteLineMat);
        this.ensureWaypointsFor(z);
        const wpIndex = Math.floor(z / 500);
        const points = this.waypoints.slice(wpIndex, wpIndex + 4);
        chunk.activate(z, points, this.scene, params);
        this.scene.add(chunk.mesh, chunk.yellowLines, chunk.whiteLines);
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
        for (let i = 0; i < this.chunks.length; i++) {
            this.chunks[i].update(delta);
        }

        // Fast nearest streetlight search
        let lightIdx = 0;
        for (let c = 0; c < this.chunks.length && lightIdx < this.streetlights.length; c++) {
            const chunk = this.chunks[c];
            if (Math.abs(chunk.startZ + 250 - carZ) < 400) {
                for (let g = 0; g < chunk.streetlightGlows.length && lightIdx < this.streetlights.length; g++) {
                    const glowPos = chunk.streetlightGlows[g];
                    if (glowPos.distanceToSquared(carPos) < 2500) {
                        this.streetlights[lightIdx].position.copy(glowPos);
                        this.streetlights[lightIdx].intensity = 2.8;
                        lightIdx++;
                    }
                }
            }
        }
        while (lightIdx < this.streetlights.length) {
            this.streetlights[lightIdx].intensity = 0;
            lightIdx++;
        }

        // Shared Neon Lights (attached dynamically to closest signs)
        let neonIdx = 0;
        const tempSignPos = new THREE.Vector3();
        for (let c = 0; c < this.chunks.length && neonIdx < this.neonLights.length; c++) {
            const chunk = this.chunks[c];
            if (Math.abs(chunk.startZ + 250 - carZ) < 300) {
                for (let s = 0; s < chunk.neonSigns.length && neonIdx < this.neonLights.length; s++) {
                    const sign = chunk.neonSigns[s];
                    sign.getWorldPosition(tempSignPos);
                    const distSq = tempSignPos.distanceToSquared(carPos);
                    if (distSq < 2500) {
                        this.neonLights[neonIdx].position.copy(tempSignPos);
                        this.neonLights[neonIdx].color.copy(sign.color);
                        this.neonLights[neonIdx].intensity = sign.effectiveIntensity * 2.2;
                        neonIdx++;
                    }
                }
            }
        }
        while (neonIdx < this.neonLights.length) {
            this.neonLights[neonIdx].intensity = 0;
            neonIdx++;
        }

        // Recycling chunks
        const lookahead = Math.min(5, config.chunkLimit) * 500;
        if (this.chunks.length > 0 && carZ - this.chunks[0].startZ > 650) {
            const old = this.chunks.shift();
            if (old) {
                this.scene.remove(old.mesh, old.yellowLines, old.whiteLines, old.cityGroup);
                this.pool.push(old);
            }
        }
        const lastChunk = this.chunks[this.chunks.length - 1];
        if (lastChunk && lastChunk.startZ - carZ < lookahead) {
            const nextZ = lastChunk.startZ + 500;
            this.spawnChunk(nextZ, this.biomeManager.getParamsAt(nextZ));
        }
    }

    public setRoadEnvMap(envMap: THREE.Texture): void {
        this.material.envMap = envMap;
        this.material.roughness = 0.32;
        this.material.metalness = 0.45;
        this.material.envMapIntensity = 1.8;
        this.material.needsUpdate = true;
    }

    public getRoadMeshes(): THREE.Object3D[] {
        return this.chunks.map(c => c.mesh);
    }
}
