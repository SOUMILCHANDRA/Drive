import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
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
    // Terrain: Rich nocturnal California landscape (smooth normals, vertex-colored)
    public static terrainMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        vertexColors: true,
        roughness: 0.92,
        metalness: 0.06,
        flatShading: false,
    });

    // Streetlights
    public static poleMaterial = new THREE.MeshStandardMaterial({ color: 0x242838, roughness: 0.7, metalness: 0.5 });
    public static lampMaterial = new THREE.MeshBasicMaterial({ color: 0xffb35a, toneMapped: false });
    public static streetlightPoleGeo = (() => { const g = new THREE.CylinderGeometry(0.09, 0.22, 7.5, 6); g.clearGroups(); return g; })();
    public static streetlightArmGeo = (() => { const g = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6); g.clearGroups(); return g; })();
    public static streetlightLampGeo = new THREE.SphereGeometry(0.28, 6, 5);

    // Lamp Bulb Volumetric Glow Sprite (Bug 3a: crossed billboard, additive)
    private static lampGlowTex: THREE.CanvasTexture | null = null;
    public static getLampGlowTexture(): THREE.CanvasTexture {
        if (!this.lampGlowTex) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d')!;
            const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0.0, 'rgba(255, 235, 190, 1.0)');
            grad.addColorStop(0.25, 'rgba(255, 179, 90, 0.7)');
            grad.addColorStop(0.65, 'rgba(255, 140, 50, 0.18)');
            grad.addColorStop(1.0, 'rgba(255, 140, 50, 0.0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 64, 64);
            this.lampGlowTex = new THREE.CanvasTexture(canvas);
        }
        return this.lampGlowTex;
    }

    public static lampGlowGeo = (() => {
        const geo = new THREE.BufferGeometry();
        const s = 1.35;
        const positions = new Float32Array([
            // Quad 1: XY plane
            -s, -s, 0,   s, -s, 0,   s,  s, 0,
            -s, -s, 0,   s,  s, 0,  -s,  s, 0,
            // Quad 2: YZ plane
            0, -s, -s,   0, -s,  s,   0,  s,  s,
            0, -s, -s,   0,  s,  s,   0,  s, -s,
        ]);
        const uvs = new Float32Array([
            0, 0,  1, 0,  1, 1,
            0, 0,  1, 1,  0, 1,
            0, 0,  1, 0,  1, 1,
            0, 0,  1, 1,  0, 1,
        ]);
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        return geo;
    })();

    public static lampGlowMat = new THREE.MeshBasicMaterial({
        map: SharedRoadAssets.getLampGlowTexture(),
        color: 0xffb35a,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
    });

    // Road Light-Pool Decal (Bug 3a: radial-gradient quad on road under each lamp)
    private static lightPoolTex: THREE.CanvasTexture | null = null;
    public static getLightPoolTexture(): THREE.CanvasTexture {
        if (!this.lightPoolTex) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d')!;
            const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            grad.addColorStop(0.0, 'rgba(255, 179, 90, 1.0)');
            grad.addColorStop(0.3, 'rgba(255, 179, 90, 0.65)');
            grad.addColorStop(0.7, 'rgba(255, 179, 90, 0.2)');
            grad.addColorStop(1.0, 'rgba(255, 179, 90, 0.0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 128, 128);
            this.lightPoolTex = new THREE.CanvasTexture(canvas);
        }
        return this.lightPoolTex;
    }

    public static lightPoolGeo = (() => {
        const geo = new THREE.PlaneGeometry(12.0, 12.0);
        geo.rotateX(-Math.PI / 2);
        return geo;
    })();

    public static lightPoolMat = new THREE.MeshBasicMaterial({
        map: SharedRoadAssets.getLightPoolTexture(),
        color: 0xffb35a,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2
    });

    // Highway Guardrails
    public static guardrailMat = new THREE.MeshStandardMaterial({ color: 0x484f64, roughness: 0.45, metalness: 0.7 });
    public static reflectorRedMat = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
    public static reflectorWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf5f8ff, toneMapped: false });
    public static guardrailPostGeo = (() => { const g = new THREE.BoxGeometry(0.14, 0.95, 0.14); g.clearGroups(); return g; })();
    public static guardrailBeamGeo = (() => { const g = new THREE.BoxGeometry(0.08, 0.36, 12.6); g.clearGroups(); return g; })();
    public static reflectorGeo = (() => { const g = new THREE.BoxGeometry(0.06, 0.14, 0.14); g.clearGroups(); return g; })();

    // Road Studs (Cat's Eyes)
    public static studMat = new THREE.MeshBasicMaterial({ color: 0xffb830, toneMapped: false });
    public static studGeo = (() => { const g = new THREE.BoxGeometry(0.16, 0.06, 0.24); g.clearGroups(); return g; })();

    // Palms
    public static palmTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x281a10, roughness: 0.95 });
    public static palmFrondMaterial = new THREE.MeshStandardMaterial({ color: 0x142208, roughness: 0.95, side: THREE.DoubleSide });
    public static palmTrunkGeo = (() => { const g = new THREE.CylinderGeometry(0.14, 0.32, 11.5, 6); g.clearGroups(); return g; })();
    public static palmFrondGeo = new THREE.PlaneGeometry(0.55, 4.2);

    // Freeway Overpass with side pillars
    public static overpassMat = new THREE.MeshStandardMaterial({ color: 0x1e2433, roughness: 0.85, metalness: 0.2 });
    public static overpassGeo = (() => {
        const deck = new THREE.BoxGeometry(26, 1.4, 6.5);
        deck.clearGroups();
        const pillarL = new THREE.CylinderGeometry(0.65, 0.65, 8.0, 8);
        pillarL.clearGroups();
        pillarL.translate(-9.2, -3.8, 0);
        const pillarR = new THREE.CylinderGeometry(0.65, 0.65, 8.0, 8);
        pillarR.clearGroups();
        pillarR.translate(9.2, -3.8, 0);
        const merged = BufferGeometryUtils.mergeGeometries([deck, pillarL, pillarR]);
        merged.clearGroups();
        return merged;
    })();
    public static gantrySignMat = new THREE.MeshBasicMaterial({ color: 0x00552b });
    public static gantrySignGeo = (() => { const g = new THREE.PlaneGeometry(6.5, 2.2); g.clearGroups(); return g; })();

    // Bridge: 42m tall suspension pylons & red warning beacons
    public static bridgePylonGeo = (() => {
        const tL = new THREE.BoxGeometry(1.6, 42, 1.8);
        tL.clearGroups();
        tL.translate(-8.6, 21, 0);
        const tR = new THREE.BoxGeometry(1.6, 42, 1.8);
        tR.clearGroups();
        tR.translate(8.6, 21, 0);
        const beam = new THREE.BoxGeometry(18.8, 1.5, 1.6);
        beam.clearGroups();
        beam.translate(0, 36, 0);
        const merged = BufferGeometryUtils.mergeGeometries([tL, tR, beam]);
        merged.clearGroups();
        return merged;
    })();
    public static bridgePylonMat = new THREE.MeshStandardMaterial({
        color: 0x222a3a,
        roughness: 0.6,
        metalness: 0.4
    });
    public static beaconGeo = new THREE.SphereGeometry(0.45, 8, 6);
    public static beaconRedMat = new THREE.MeshBasicMaterial({ color: 0xff1818, toneMapped: false });

    // Gas Station Oasis: Illuminated canopy, fuel dispensers, forecourt light, and neon totem
    public static gasCanopyGeo = (() => {
        const roof = new THREE.BoxGeometry(20, 0.8, 12);
        roof.clearGroups();
        roof.translate(0, 5.2, 0);
        const p1 = new THREE.CylinderGeometry(0.24, 0.24, 5.2, 8);
        p1.clearGroups();
        p1.translate(-6, 2.6, -3.5);
        const p2 = new THREE.CylinderGeometry(0.24, 0.24, 5.2, 8);
        p2.clearGroups();
        p2.translate(6, 2.6, -3.5);
        const p3 = new THREE.CylinderGeometry(0.24, 0.24, 5.2, 8);
        p3.clearGroups();
        p3.translate(-6, 2.6, 3.5);
        const p4 = new THREE.CylinderGeometry(0.24, 0.24, 5.2, 8);
        p4.clearGroups();
        p4.translate(6, 2.6, 3.5);
        const island1 = new THREE.BoxGeometry(1.2, 1.4, 2.8);
        island1.clearGroups();
        island1.translate(-3.5, 0.7, 0);
        const island2 = new THREE.BoxGeometry(1.2, 1.4, 2.8);
        island2.clearGroups();
        island2.translate(3.5, 0.7, 0);
        const merged = BufferGeometryUtils.mergeGeometries([roof, p1, p2, p3, p4, island1, island2]);
        merged.clearGroups();
        return merged;
    })();
    public static gasCanopyMat = new THREE.MeshStandardMaterial({
        color: 0x242a3a,
        roughness: 0.5,
        metalness: 0.3
    });
    public static gasForecourtGeo = (() => {
        const pad = new THREE.PlaneGeometry(22, 14);
        pad.clearGroups();
        pad.rotateX(-Math.PI / 2);
        return pad;
    })();
    public static gasForecourtMat = new THREE.MeshBasicMaterial({
        color: 0xffe8b0,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1.5,
        polygonOffsetUnits: -1.5
    });
    public static gasTotemGeo = (() => {
        const pole = new THREE.BoxGeometry(0.6, 11, 0.6);
        pole.clearGroups();
        pole.translate(0, 5.5, 0);
        const board = new THREE.BoxGeometry(4.2, 3.2, 0.8);
        board.clearGroups();
        board.translate(0, 9.5, 0);
        const merged = BufferGeometryUtils.mergeGeometries([pole, board]);
        merged.clearGroups();
        return merged;
    })();
    public static gasTotemMat = new THREE.MeshStandardMaterial({
        color: 0x161a26,
        roughness: 0.6,
        metalness: 0.4
    });
    public static gasSignFaceGeo = (() => { const g = new THREE.PlaneGeometry(3.8, 2.8); g.clearGroups(); return g; })();
    public static gasSignFaceMat = new THREE.MeshBasicMaterial({
        color: 0xff2a85, // hot pink neon glow
        toneMapped: false
    });

    // Side Exit: 4.2m wide x 90m long off-ramp branching right
    public static exitRampGeo = (() => {
        const geo = new THREE.PlaneGeometry(4.2, 90, 1, 8);
        geo.clearGroups();
        geo.rotateX(-Math.PI / 2);
        return geo;
    })();

    // Lit Intersection on Non-Player Side (x < 0)
    public static crossStreetGeo = (() => {
        const plane = new THREE.PlaneGeometry(24, 8);
        plane.clearGroups();
        plane.rotateX(-Math.PI / 2);
        plane.translate(-19, 0.02, 0);
        return plane;
    })();
    public static trafficSignalGeo = (() => {
        const pole = new THREE.CylinderGeometry(0.12, 0.16, 7.5, 8);
        pole.clearGroups();
        pole.translate(-7.5, 3.75, 0);
        const arm = new THREE.CylinderGeometry(0.08, 0.08, 8.0, 6);
        arm.clearGroups();
        arm.rotateZ(Math.PI / 2);
        arm.translate(-11.5, 7.0, 0);
        const box = new THREE.BoxGeometry(0.35, 0.95, 0.35);
        box.clearGroups();
        box.translate(-12.5, 6.3, 0);
        const merged = BufferGeometryUtils.mergeGeometries([pole, arm, box]);
        merged.clearGroups();
        return merged;
    })();
    public static trafficSignalMat = new THREE.MeshStandardMaterial({
        color: 0x222630,
        roughness: 0.6,
        metalness: 0.5
    });
    public static signalLensGeo = new THREE.SphereGeometry(0.14, 6, 4);
    public static signalGreenMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        toneMapped: false
    });

    // Buildings & Procedural Windows (Bug 3d: crisp window grid, ~20% warm yellow/cool cyan lit)
    public static buildingBodyMat = new THREE.MeshStandardMaterial({
        color: 0x14142a,
        roughness: 0.8,
        metalness: 0.1
    });

    // Helper: evaluate continuous terrain elevation at any (x, z)
    public static computeTerrainElevation(bx: number, bz: number, roadY: number, sideDistance: number): number {
        const terrainStart = 7.4;
        const terrainWidth = 460;
        const u = Math.max(0.0, Math.min(1.0, (sideDistance - terrainStart) / terrainWidth));
        if (u <= 0.001) return roadY;

        const hillLow = noise2D(bx * 0.0035, bz * 0.0025) * 58;
        const hillMid = noise2D(bx * 0.012, bz * 0.009) * 16;
        const hillHigh = noise2D(bx * 0.03, bz * 0.02) * 4.5;
        const totalHill = hillLow + hillMid + hillHigh;

        const blend = Math.pow(Math.min(1.0, u / 0.16), 1.5);
        const taper = Math.cos(Math.max(0.0, (u - 0.75) / 0.25) * (Math.PI / 2));
        let elevation = roadY - 0.32 + (totalHill * blend * taper);

        // Bridge section (every 6000m at offset 1500-3000m): drop terrain into a coastal bay
        const cycleZ = ((bz % 6000) + 6000) % 6000;
        if (cycleZ >= 1400 && cycleZ <= 3100) {
            const bridgeCenter = 2250;
            const bDist = Math.abs(cycleZ - bridgeCenter);
            const dropFactor = Math.max(0.0, 1.0 - bDist / 850);
            const drop = dropFactor * dropFactor * 24.0;
            elevation = Math.min(roadY - 1.2, elevation - drop);
        }

        return elevation;
    }

    public static windowMatAmber = new THREE.MeshBasicMaterial({ color: 0xff9933, toneMapped: false });
    public static windowMatGold = new THREE.MeshBasicMaterial({ color: 0xffc855, toneMapped: false });
    public static windowMatCyan = new THREE.MeshBasicMaterial({ color: 0x44ddff, toneMapped: false });
    public static windowGeo = new THREE.PlaneGeometry(0.65, 0.75);

    // Tunnel Arches
    public static archGeo = new THREE.TorusGeometry(14, 1.4, 8, 16, Math.PI);
    public static archMat = new THREE.MeshStandardMaterial({ color: 0x161c28, roughness: 0.85 });

    // Billboards
    public static billboardPoleGeo = (() => { const g = new THREE.CylinderGeometry(0.2, 0.32, 14, 6); g.clearGroups(); return g; })();
    public static billboardBoardGeo = (() => { const g = new THREE.PlaneGeometry(13, 3.4); g.clearGroups(); return g; })();
    private static billboardTextures: THREE.CanvasTexture[] = [];
    private static billboardMaterials: THREE.MeshBasicMaterial[] = [];

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

    public static getBillboardMaterial(index: number): THREE.MeshBasicMaterial {
        const i = index % 7;
        if (!this.billboardMaterials[i]) {
            this.billboardMaterials[i] = new THREE.MeshBasicMaterial({
                map: this.getBillboardTexture(i)
            });
        }
        return this.billboardMaterials[i];
    }
}

// Inject procedural window shader into buildingBodyMat (axis-aligned grid windows, no skew, ~20% lit)
SharedRoadAssets.buildingBodyMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
        varying vec2 vFacadeCoord;
        varying float vIsFacade;`
    );
    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
            float instW = length(instanceMatrix[0].xyz);
            float instH = length(instanceMatrix[1].xyz);
            float instD = length(instanceMatrix[2].xyz);
            if (abs(normal.y) < 0.25) {
                vIsFacade = 1.0;
                if (abs(normal.x) > 0.5) {
                    vFacadeCoord = vec2(position.z * instD, (position.y + 0.5) * instH);
                } else {
                    vFacadeCoord = vec2(position.x * instW, (position.y + 0.5) * instH);
                }
            } else {
                vIsFacade = 0.0;
                vFacadeCoord = vec2(0.0);
            }
        #else
            vIsFacade = 0.0;
            vFacadeCoord = vec2(0.0);
        #endif`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
        varying vec2 vFacadeCoord;
        varying float vIsFacade;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
        // Procedural crisp axis-aligned rectangular window grid on building facades (~20% lit, warm and cool)
        if (vIsFacade > 0.5) {
            float cellW = 2.6; // window cell width 2.6m
            float cellH = 3.4; // window cell height 3.4m

            vec2 cellCoord = vec2(vFacadeCoord.x / cellW, vFacadeCoord.y / cellH);
            vec2 g = fract(cellCoord);
            vec2 cellId = floor(cellCoord);

            // Crisp window rectangle: width 0.58 of cell, height 0.64 of cell
            vec2 wBox = step(vec2(0.21, 0.18), g) * (1.0 - step(vec2(0.79, 0.82), g));
            float isWin = wBox.x * wBox.y;

            if (isWin > 0.5) {
                float rnd = fract(sin(dot(cellId, vec2(12.9898, 78.233))) * 43758.5453);
                // ~20% of windows lit with warm gold / cool cyan emissive
                if (rnd < 0.20) {
                    vec3 winColor = (rnd < 0.14) ? vec3(1.0, 0.78, 0.35) : vec3(0.28, 0.88, 1.0);
                    outgoingLight += winColor * 2.0;
                }
            }
        }
        #include <opaque_fragment>
        `
    );
};

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
    private streetLampGlowsMesh: THREE.InstancedMesh;
    private streetLightPoolsMesh: THREE.InstancedMesh;
    private palmTrunksMesh: THREE.InstancedMesh;
    private palmFrondsMesh: THREE.InstancedMesh;
    private tunnelArchesMesh: THREE.InstancedMesh;
    private guardrailPostsMesh: THREE.InstancedMesh;
    private guardrailBeamsMesh: THREE.InstancedMesh;
    private guardrailReflectorsMesh: THREE.InstancedMesh;
    private roadStudsMesh: THREE.InstancedMesh;
    private overpassMesh: THREE.InstancedMesh;
    private billboardsGroup: THREE.Group;

    // Landmark & Layout Instanced Meshes (Bug 4)
    private bridgePylonsMesh: THREE.InstancedMesh;
    private bridgeBeaconsMesh: THREE.InstancedMesh;
    private gasCanopyMesh: THREE.InstancedMesh;
    private gasForecourtMesh: THREE.InstancedMesh;
    private gasTotemMesh: THREE.InstancedMesh;
    private gasSignFaceMesh: THREE.InstancedMesh;
    private exitRampsMesh: THREE.InstancedMesh;
    private exitSignsMesh: THREE.InstancedMesh;
    private crossStreetsMesh: THREE.InstancedMesh;
    private trafficSignalsMesh: THREE.InstancedMesh;
    private signalLensesMesh: THREE.InstancedMesh;

    private dummy = new THREE.Object3D();

    constructor(roadMaterial: THREE.Material, yellowMat: THREE.Material, whiteMat: THREE.Material) {
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 500, 1, 40), roadMaterial);
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = true;

        this.yellowLines = new THREE.LineSegments(new THREE.BufferGeometry(), yellowMat);
        this.yellowLines.frustumCulled = true;
        this.whiteLines = new THREE.LineSegments(new THREE.BufferGeometry(), whiteMat);
        this.whiteLines.frustumCulled = true;
        this.curve = new THREE.CatmullRomCurve3();
        this.cityGroup = new THREE.Group();

        // 1. Terrain Meshes
        this.leftTerrainMesh = this.initTerrainMesh();
        this.rightTerrainMesh = this.initTerrainMesh();
        this.leftTerrainMesh.frustumCulled = true;
        this.rightTerrainMesh.frustumCulled = true;
        this.cityGroup.add(this.leftTerrainMesh);
        this.cityGroup.add(this.rightTerrainMesh);

        // 2. Instanced Highway Meshes
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        boxGeo.clearGroups();
        this.buildingMesh = new THREE.InstancedMesh(boxGeo, SharedRoadAssets.buildingBodyMat, MAX_BUILDINGS);
        this.windowAmberMesh = new THREE.InstancedMesh(SharedRoadAssets.windowGeo, SharedRoadAssets.windowMatAmber, MAX_WINDOWS);
        this.windowGoldMesh = new THREE.InstancedMesh(SharedRoadAssets.windowGeo, SharedRoadAssets.windowMatGold, MAX_WINDOWS);
        this.windowCyanMesh = new THREE.InstancedMesh(SharedRoadAssets.windowGeo, SharedRoadAssets.windowMatCyan, MAX_WINDOWS);

        this.streetPolesMesh = new THREE.InstancedMesh(SharedRoadAssets.streetlightPoleGeo, SharedRoadAssets.poleMaterial, MAX_STREETLIGHTS);
        this.streetArmsMesh = new THREE.InstancedMesh(SharedRoadAssets.streetlightArmGeo, SharedRoadAssets.poleMaterial, MAX_STREETLIGHTS);
        this.streetLampsMesh = new THREE.InstancedMesh(SharedRoadAssets.streetlightLampGeo, SharedRoadAssets.lampMaterial, MAX_STREETLIGHTS);
        this.streetLampGlowsMesh = new THREE.InstancedMesh(SharedRoadAssets.lampGlowGeo, SharedRoadAssets.lampGlowMat, MAX_STREETLIGHTS);
        this.streetLightPoolsMesh = new THREE.InstancedMesh(SharedRoadAssets.lightPoolGeo, SharedRoadAssets.lightPoolMat, MAX_STREETLIGHTS);

        this.palmTrunksMesh = new THREE.InstancedMesh(SharedRoadAssets.palmTrunkGeo, SharedRoadAssets.palmTrunkMaterial, MAX_PALMS);
        this.palmFrondsMesh = new THREE.InstancedMesh(SharedRoadAssets.palmFrondGeo, SharedRoadAssets.palmFrondMaterial, MAX_FRONDS);
        this.tunnelArchesMesh = new THREE.InstancedMesh(SharedRoadAssets.archGeo, SharedRoadAssets.archMat, 16);

        this.guardrailPostsMesh = new THREE.InstancedMesh(SharedRoadAssets.guardrailPostGeo, SharedRoadAssets.guardrailMat, MAX_GUARDRAILS);
        this.guardrailBeamsMesh = new THREE.InstancedMesh(SharedRoadAssets.guardrailBeamGeo, SharedRoadAssets.guardrailMat, MAX_GUARDRAILS);
        this.guardrailReflectorsMesh = new THREE.InstancedMesh(SharedRoadAssets.reflectorGeo, SharedRoadAssets.reflectorRedMat, MAX_GUARDRAILS);
        this.roadStudsMesh = new THREE.InstancedMesh(SharedRoadAssets.studGeo, SharedRoadAssets.studMat, MAX_STUDS);
        this.overpassMesh = new THREE.InstancedMesh(SharedRoadAssets.overpassGeo, SharedRoadAssets.overpassMat, 4);

        // Landmark & Highway Layout Instanced Meshes (Bug 4)
        this.bridgePylonsMesh = new THREE.InstancedMesh(SharedRoadAssets.bridgePylonGeo, SharedRoadAssets.bridgePylonMat, 2);
        this.bridgeBeaconsMesh = new THREE.InstancedMesh(SharedRoadAssets.beaconGeo, SharedRoadAssets.beaconRedMat, 4);

        this.gasCanopyMesh = new THREE.InstancedMesh(SharedRoadAssets.gasCanopyGeo, SharedRoadAssets.gasCanopyMat, 2);
        this.gasForecourtMesh = new THREE.InstancedMesh(SharedRoadAssets.gasForecourtGeo, SharedRoadAssets.gasForecourtMat, 2);
        this.gasTotemMesh = new THREE.InstancedMesh(SharedRoadAssets.gasTotemGeo, SharedRoadAssets.gasTotemMat, 2);
        this.gasSignFaceMesh = new THREE.InstancedMesh(SharedRoadAssets.gasSignFaceGeo, SharedRoadAssets.gasSignFaceMat, 2);

        this.exitRampsMesh = new THREE.InstancedMesh(SharedRoadAssets.exitRampGeo, roadMaterial, 2);
        this.exitSignsMesh = new THREE.InstancedMesh(SharedRoadAssets.gantrySignGeo, SharedRoadAssets.gantrySignMat, 2);

        this.crossStreetsMesh = new THREE.InstancedMesh(SharedRoadAssets.crossStreetGeo, roadMaterial, 2);
        this.trafficSignalsMesh = new THREE.InstancedMesh(SharedRoadAssets.trafficSignalGeo, SharedRoadAssets.trafficSignalMat, 2);
        this.signalLensesMesh = new THREE.InstancedMesh(SharedRoadAssets.signalLensGeo, SharedRoadAssets.signalGreenMat, 2);

        this.billboardsGroup = new THREE.Group();

        const allInstanced = [
            this.buildingMesh,
            this.windowAmberMesh,
            this.windowGoldMesh,
            this.windowCyanMesh,
            this.streetPolesMesh,
            this.streetArmsMesh,
            this.streetLampsMesh,
            this.streetLampGlowsMesh,
            this.streetLightPoolsMesh,
            this.palmTrunksMesh,
            this.palmFrondsMesh,
            this.tunnelArchesMesh,
            this.guardrailPostsMesh,
            this.guardrailBeamsMesh,
            this.guardrailReflectorsMesh,
            this.roadStudsMesh,
            this.overpassMesh,
            this.bridgePylonsMesh,
            this.bridgeBeaconsMesh,
            this.gasCanopyMesh,
            this.gasForecourtMesh,
            this.gasTotemMesh,
            this.gasSignFaceMesh,
            this.exitRampsMesh,
            this.exitSignsMesh,
            this.crossStreetsMesh,
            this.trafficSignalsMesh,
            this.signalLensesMesh
        ];
        for (const m of allInstanced) {
            m.visible = false;
            m.count = 0;
            m.castShadow = false;
            m.receiveShadow = false;
            m.frustumCulled = false;
        }
        this.buildingMesh.castShadow = true;
        this.buildingMesh.receiveShadow = true;
        this.buildingMesh.layers.enable(1); // Road dynamic reflection
        this.overpassMesh.castShadow = true;
        this.bridgePylonsMesh.castShadow = true;
        this.bridgePylonsMesh.layers.enable(1);
        this.tunnelArchesMesh.castShadow = true;
        this.gasCanopyMesh.castShadow = true;
        this.gasCanopyMesh.layers.enable(1);

        this.cityGroup.add(
            this.buildingMesh,
            this.windowAmberMesh,
            this.windowGoldMesh,
            this.windowCyanMesh,
            this.streetPolesMesh,
            this.streetArmsMesh,
            this.streetLampsMesh,
            this.streetLampGlowsMesh,
            this.streetLightPoolsMesh,
            this.palmTrunksMesh,
            this.palmFrondsMesh,
            this.tunnelArchesMesh,
            this.guardrailPostsMesh,
            this.guardrailBeamsMesh,
            this.guardrailReflectorsMesh,
            this.roadStudsMesh,
            this.overpassMesh,
            this.bridgePylonsMesh,
            this.bridgeBeaconsMesh,
            this.gasCanopyMesh,
            this.gasForecourtMesh,
            this.gasTotemMesh,
            this.gasSignFaceMesh,
            this.exitRampsMesh,
            this.exitSignsMesh,
            this.crossStreetsMesh,
            this.trafficSignalsMesh,
            this.signalLensesMesh,
            this.billboardsGroup
        );
    }

    private initTerrainMesh(): THREE.Mesh {
        const vertexCount = (SEG_X + 1) * (SEG_Z + 1);
        const positions = new Float32Array(vertexCount * 3);
        const colors = new Float32Array(vertexCount * 3);
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
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geo.setIndex(indices);

        const mesh = new THREE.Mesh(geo, SharedRoadAssets.terrainMaterial);
        mesh.receiveShadow = true;
        return mesh;
    }

    public activate(startZ: number, points: THREE.Vector3[], scene: THREE.Scene, params: BiomeParams, worldZOffset: number = 0): void {
        this.startZ = startZ;
        this.curve = new THREE.CatmullRomCurve3(points);
        this.updateGeometry();
        this.generateCity(scene, params, worldZOffset);
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
        this.mesh.geometry.computeBoundingSphere();
        this.mesh.geometry.computeBoundingBox();
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
        this.yellowLines.geometry.computeBoundingSphere();
        this.yellowLines.geometry.computeBoundingBox();

        this.whiteLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(whitePos, 3));
        this.whiteLines.geometry.computeBoundingSphere();
        this.whiteLines.geometry.computeBoundingBox();
    }

    private generateCity(_scene: THREE.Scene, params: BiomeParams, worldZOffset: number = 0): void {
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
        this.updateTerrainMesh(this.leftTerrainMesh, -1, worldZOffset);
        this.updateTerrainMesh(this.rightTerrainMesh, 1, worldZOffset);

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
        let bridgePylonCount = 0;
        let bridgeBeaconCount = 0;
        let gasCanopyCount = 0;
        let gasForecourtCount = 0;
        let gasTotemCount = 0;
        let gasSignFaceCount = 0;
        let exitRampCount = 0;
        let exitSignCount = 0;
        let crossStreetCount = 0;
        let trafficSignalCount = 0;
        let signalLensCount = 0;

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

        // 4. Occasional Highway Overpasses (Bug 4)
        if (params.name !== 'THE TUNNEL' && params.name !== 'TUNNEL' && params.name !== 'THE BRIDGE') {
            if ((this.startZ % 1500) === 0 && this.startZ > 0) {
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
        }

        // 5. Tunnel Arch Check (Bug 4 landmark)
        if (params.name === 'THE TUNNEL' || params.name === 'TUNNEL') {
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
            this.tunnelArchesMesh.visible = archCount > 0;
            this.tunnelArchesMesh.count = archCount;
            this.tunnelArchesMesh.instanceMatrix.needsUpdate = archCount > 0;
            this.applyMeshCounts(
                buildingCount, amberWinCount, goldWinCount, cyanWinCount, streetCount,
                palmCount, frondCount, guardrailCount, studCount, overpassCount,
                bridgePylonCount, bridgeBeaconCount, gasCanopyCount, gasForecourtCount,
                gasTotemCount, gasSignFaceCount, exitRampCount, exitSignCount,
                crossStreetCount, trafficSignalCount, signalLensCount
            );
            return;
        } else {
            this.tunnelArchesMesh.visible = false;
            this.tunnelArchesMesh.count = 0;
        }

        // 6. The Bridge Landmark Check (Bug 4: 42m suspension towers with red beacons)
        if (params.name === 'THE BRIDGE') {
            if (this.startZ % 1500 === 500) {
                const t = 0.5;
                const pt = this.curve.getPoint(t);
                const tangent = this.curve.getTangent(t);
                const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

                this.dummy.position.copy(pt);
                this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                this.dummy.scale.set(1, 1, 1);
                this.dummy.updateMatrix();
                this.bridgePylonsMesh.setMatrixAt(bridgePylonCount++, this.dummy.matrix);

                // Red aviation warning beacons atop towers (y + 42m)
                [-8.6, 8.6].forEach(offset => {
                    const bpos = pt.clone().add(normal.clone().multiplyScalar(offset)).add(new THREE.Vector3(0, 42.2, 0));
                    this.dummy.position.copy(bpos);
                    this.dummy.updateMatrix();
                    this.bridgeBeaconsMesh.setMatrixAt(bridgeBeaconCount++, this.dummy.matrix);
                });
            }
        }

        // 7. Gas Station Oasis Landmark Check (Bug 4: canopy, forecourt, and pink/cyan neon totem)
        if (params.name === 'GAS STATION OASIS') {
            if (this.startZ % 1500 === 500) {
                const t = 0.5;
                const pt = this.curve.getPoint(t);
                const tangent = this.curve.getTangent(t);
                const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

                const gasPos = pt.clone().add(normal.clone().multiplyScalar(22.0));
                gasPos.y = pt.y;

                // Canopy
                this.dummy.position.copy(gasPos);
                this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                this.dummy.scale.set(1, 1, 1);
                this.dummy.updateMatrix();
                this.gasCanopyMesh.setMatrixAt(gasCanopyCount++, this.dummy.matrix);

                // Forecourt illumination decal
                const padPos = gasPos.clone();
                padPos.y = pt.y + 0.03;
                this.dummy.position.copy(padPos);
                this.dummy.updateMatrix();
                this.gasForecourtMesh.setMatrixAt(gasForecourtCount++, this.dummy.matrix);

                // Totem pylon sign
                const totemPos = pt.clone().add(normal.clone().multiplyScalar(15.0)).add(tangent.clone().multiplyScalar(-24.0));
                totemPos.y = pt.y;
                this.dummy.position.copy(totemPos);
                this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                this.dummy.updateMatrix();
                this.gasTotemMesh.setMatrixAt(gasTotemCount++, this.dummy.matrix);

                // Neon sign face on totem
                const facePos = totemPos.clone().add(new THREE.Vector3(0, 9.5, 0)).add(tangent.clone().multiplyScalar(0.42));
                this.dummy.position.copy(facePos);
                this.dummy.updateMatrix();
                this.gasSignFaceMesh.setMatrixAt(gasSignFaceCount++, this.dummy.matrix);

                this.streetlightGlows.push(gasPos.clone().add(new THREE.Vector3(0, 5.0, 0)));
            }
        }

        // 8. Side Exits (Bug 4: off-ramp branching right with green gantry sign)
        if (params.name !== 'THE TUNNEL' && params.name !== 'TUNNEL' && params.name !== 'THE BRIDGE') {
            if ((this.startZ % 1500) === 1000) {
                const t = 0.35;
                const pt = this.curve.getPoint(t);
                const tangent = this.curve.getTangent(t);
                const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

                const rampPos = pt.clone().add(normal.clone().multiplyScalar(11.5)).add(tangent.clone().multiplyScalar(25.0));
                rampPos.y = pt.y + 0.02;
                this.dummy.position.copy(rampPos);
                this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                this.dummy.rotation.y -= 0.16;
                this.dummy.scale.set(1, 1, 1);
                this.dummy.updateMatrix();
                this.exitRampsMesh.setMatrixAt(exitRampCount++, this.dummy.matrix);

                const signPos = pt.clone().add(normal.clone().multiplyScalar(5.5));
                signPos.y = pt.y + 6.8;
                this.dummy.position.copy(signPos);
                this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                this.dummy.updateMatrix();
                this.exitSignsMesh.setMatrixAt(exitSignCount++, this.dummy.matrix);
            }
        }

        // 9. Lit Intersections on Non-Player Side (Bug 4: cross street left with traffic signal)
        if (params.name !== 'THE TUNNEL' && params.name !== 'TUNNEL' && params.name !== 'THE BRIDGE') {
            if ((this.startZ % 1500) === 500 && params.name !== 'GAS STATION OASIS') {
                const t = 0.65;
                const pt = this.curve.getPoint(t);
                const tangent = this.curve.getTangent(t);

                this.dummy.position.copy(pt);
                this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                this.dummy.scale.set(1, 1, 1);
                this.dummy.updateMatrix();
                this.crossStreetsMesh.setMatrixAt(crossStreetCount++, this.dummy.matrix);

                this.trafficSignalsMesh.setMatrixAt(trafficSignalCount++, this.dummy.matrix);

                const lensPos = pt.clone().add(new THREE.Vector3(-12.5, 6.3, 0).applyQuaternion(this.dummy.quaternion));
                this.dummy.position.copy(lensPos);
                this.dummy.updateMatrix();
                this.signalLensesMesh.setMatrixAt(signalLensCount++, this.dummy.matrix);
            }
        }

        // 6. Roadside Architecture & Nature (Bug 3d & 3e: grounded on terrain elevation)
        const segments = 22;
        for (let i = 0; i < segments; i++) {
            const t = i / segments;
            const worldPos = this.curve.getPoint(t);
            const tangent = this.curve.getTangent(t);
            const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

            for (const side of [1, -1]) {
                // Instanced Buildings (Grounded on terrain elevation; procedural window shader handles windows)
                if (Math.random() < params.buildingDensity * 0.7 && buildingCount < MAX_BUILDINGS) {
                    const h = params.buildingHeight[0] + Math.random() * (params.buildingHeight[1] - params.buildingHeight[0]);
                    const w = 24 + Math.random() * 20;
                    const d = 24 + Math.random() * 20;
                    const setback = 130 + Math.random() * 110;
                    const bpos = worldPos.clone().add(normal.clone().multiplyScalar(side * setback));
                    const terrainY = SharedRoadAssets.computeTerrainElevation(bpos.x, bpos.z, worldPos.y, setback);
                    bpos.y = terrainY + h / 2 - 2.0;

                    this.dummy.position.copy(bpos);
                    this.dummy.scale.set(w, h, d);
                    this.dummy.lookAt(worldPos.clone().setY(bpos.y));
                    this.dummy.updateMatrix();
                    this.buildingMesh.setMatrixAt(buildingCount, this.dummy.matrix);

                    const bQuat = this.dummy.quaternion.clone();

                    // Neon Sign on Rooftop or Upper Facade
                    if (Math.random() < params.neonDensity && this.neonSigns.length < 2) {
                        const sign = new NeonSign();
                        const signOffset = new THREE.Vector3(0, h / 2 - 1.2, d / 2 + 0.25).applyQuaternion(bQuat);
                        sign.position.copy(bpos).add(signOffset);
                        sign.quaternion.copy(bQuat);
                        this.cityGroup.add(sign);
                        this.neonSigns.push(sign);
                    }

                    buildingCount++;
                }

                // Roadside California Palms (Bug 3e: grounded at terrain elevation)
                if (params.hasPalms && i % 2 === 0 && Math.random() < 0.8 && palmCount < MAX_PALMS) {
                    const palmDist = 10 + Math.random() * 4;
                    const ppos = worldPos.clone().add(normal.clone().multiplyScalar(side * palmDist));
                    ppos.y = SharedRoadAssets.computeTerrainElevation(ppos.x, ppos.z, worldPos.y, palmDist);

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

                // Billboards (Bug 3e: grounded at terrain elevation)
                if (Math.random() < 0.06 && params.buildingDensity > 0.1 && this.billboardsGroup.children.length < 1) {
                    const billboard = this.createBillboard();
                    const bbDist = 32 + Math.random() * 10;
                    const blpos = worldPos.clone().add(normal.clone().multiplyScalar(side * bbDist));
                    blpos.y = SharedRoadAssets.computeTerrainElevation(blpos.x, blpos.z, worldPos.y, bbDist);
                    billboard.position.copy(blpos);
                    billboard.lookAt(worldPos.clone().setY(blpos.y + 7));
                    this.billboardsGroup.add(billboard);
                }

                // Highway Streetlights (Bug 3a: pole, arm, luminaire bulb, volumetric glow sprite, and road light pool decal)
                if (i % 3 === 0 && streetCount < MAX_STREETLIGHTS) {
                    const slpos = worldPos.clone().add(normal.clone().multiplyScalar(side * 7.5));
                    slpos.y = worldPos.y;

                    // Pole (7.5m high)
                    this.dummy.position.set(slpos.x, slpos.y + 3.75, slpos.z);
                    this.dummy.rotation.set(0, 0, 0);
                    this.dummy.scale.set(1, 1, 1);
                    this.dummy.updateMatrix();
                    this.streetPolesMesh.setMatrixAt(streetCount, this.dummy.matrix);

                    // Overhanging Arm extending towards the highway
                    const armPos = slpos.clone().add(normal.clone().multiplyScalar(-side * 1.3));
                    this.dummy.position.set(armPos.x, slpos.y + 7.4, armPos.z);
                    this.dummy.rotation.set(0, 0, -side * Math.PI / 2);
                    this.dummy.scale.set(1, 1, 1);
                    this.dummy.updateMatrix();
                    this.streetArmsMesh.setMatrixAt(streetCount, this.dummy.matrix);

                    // Sodium Luminaire Bulb
                    const bulbPos = slpos.clone().add(normal.clone().multiplyScalar(-side * 2.5));
                    bulbPos.y = slpos.y + 7.2;
                    this.dummy.position.copy(bulbPos);
                    this.dummy.rotation.set(0, 0, 0);
                    this.dummy.scale.set(1, 1, 1);
                    this.dummy.updateMatrix();
                    this.streetLampsMesh.setMatrixAt(streetCount, this.dummy.matrix);

                    // Volumetric Glow Sprite (crossed billboard, additive)
                    this.streetLampGlowsMesh.setMatrixAt(streetCount, this.dummy.matrix);

                    // Road Light-Pool Decal directly under the luminaire
                    const decalPos = bulbPos.clone();
                    decalPos.y = worldPos.y + 0.04;
                    this.dummy.position.copy(decalPos);
                    this.dummy.rotation.set(0, 0, 0);
                    this.dummy.scale.set(1, 1, 1);
                    this.dummy.updateMatrix();
                    this.streetLightPoolsMesh.setMatrixAt(streetCount, this.dummy.matrix);

                    this.streetlightGlows.push(bulbPos);
                    streetCount++;
                }
            }
        }

        this.applyMeshCounts(
            buildingCount, amberWinCount, goldWinCount, cyanWinCount, streetCount,
            palmCount, frondCount, guardrailCount, studCount, overpassCount,
            bridgePylonCount, bridgeBeaconCount, gasCanopyCount, gasForecourtCount,
            gasTotemCount, gasSignFaceCount, exitRampCount, exitSignCount,
            crossStreetCount, trafficSignalCount, signalLensCount
        );
    }

    private applyMeshCounts(
        bCount: number, _aWin: number, _gWin: number, _cWin: number, sCount: number,
        pCount: number, fCount: number, gRail: number, stud: number, over: number,
        bPylon: number, bBeacon: number, gCanopy: number, gForecourt: number,
        gTotem: number, gSignFace: number, eRamp: number, eSign: number,
        cStreet: number, tSignal: number, sLens: number
    ): void {
        this.buildingMesh.visible = bCount > 0;
        this.buildingMesh.count = bCount;
        this.buildingMesh.instanceMatrix.needsUpdate = bCount > 0;

        // Procedural window shader on buildingBodyMat handles windows (Bug 3d)
        this.windowAmberMesh.visible = false;
        this.windowAmberMesh.count = 0;
        this.windowGoldMesh.visible = false;
        this.windowGoldMesh.count = 0;
        this.windowCyanMesh.visible = false;
        this.windowCyanMesh.count = 0;

        this.streetPolesMesh.visible = sCount > 0;
        this.streetPolesMesh.count = sCount;
        this.streetPolesMesh.instanceMatrix.needsUpdate = sCount > 0;

        this.streetArmsMesh.visible = sCount > 0;
        this.streetArmsMesh.count = sCount;
        this.streetArmsMesh.instanceMatrix.needsUpdate = sCount > 0;

        this.streetLampsMesh.visible = sCount > 0;
        this.streetLampsMesh.count = sCount;
        this.streetLampsMesh.instanceMatrix.needsUpdate = sCount > 0;

        this.streetLampGlowsMesh.visible = sCount > 0;
        this.streetLampGlowsMesh.count = sCount;
        this.streetLampGlowsMesh.instanceMatrix.needsUpdate = sCount > 0;

        this.streetLightPoolsMesh.visible = sCount > 0;
        this.streetLightPoolsMesh.count = sCount;
        this.streetLightPoolsMesh.instanceMatrix.needsUpdate = sCount > 0;

        this.palmTrunksMesh.visible = pCount > 0;
        this.palmTrunksMesh.count = pCount;
        this.palmTrunksMesh.instanceMatrix.needsUpdate = pCount > 0;

        this.palmFrondsMesh.visible = fCount > 0;
        this.palmFrondsMesh.count = fCount;
        this.palmFrondsMesh.instanceMatrix.needsUpdate = fCount > 0;

        this.tunnelArchesMesh.visible = false;
        this.tunnelArchesMesh.count = 0;

        this.guardrailPostsMesh.visible = gRail > 0;
        this.guardrailPostsMesh.count = gRail;
        this.guardrailPostsMesh.instanceMatrix.needsUpdate = gRail > 0;

        const gBeam = Math.floor(gRail / 2);
        this.guardrailBeamsMesh.visible = gBeam > 0;
        this.guardrailBeamsMesh.count = gBeam;
        this.guardrailBeamsMesh.instanceMatrix.needsUpdate = gBeam > 0;

        this.guardrailReflectorsMesh.visible = gRail > 0;
        this.guardrailReflectorsMesh.count = gRail;
        this.guardrailReflectorsMesh.instanceMatrix.needsUpdate = gRail > 0;

        this.roadStudsMesh.visible = stud > 0;
        this.roadStudsMesh.count = stud;
        this.roadStudsMesh.instanceMatrix.needsUpdate = stud > 0;

        this.overpassMesh.visible = over > 0;
        this.overpassMesh.count = over;
        this.overpassMesh.instanceMatrix.needsUpdate = over > 0;

        this.bridgePylonsMesh.visible = bPylon > 0;
        this.bridgePylonsMesh.count = bPylon;
        this.bridgePylonsMesh.instanceMatrix.needsUpdate = bPylon > 0;

        this.bridgeBeaconsMesh.visible = bBeacon > 0;
        this.bridgeBeaconsMesh.count = bBeacon;
        this.bridgeBeaconsMesh.instanceMatrix.needsUpdate = bBeacon > 0;

        this.gasCanopyMesh.visible = gCanopy > 0;
        this.gasCanopyMesh.count = gCanopy;
        this.gasCanopyMesh.instanceMatrix.needsUpdate = gCanopy > 0;

        this.gasForecourtMesh.visible = gForecourt > 0;
        this.gasForecourtMesh.count = gForecourt;
        this.gasForecourtMesh.instanceMatrix.needsUpdate = gForecourt > 0;

        this.gasTotemMesh.visible = gTotem > 0;
        this.gasTotemMesh.count = gTotem;
        this.gasTotemMesh.instanceMatrix.needsUpdate = gTotem > 0;

        this.gasSignFaceMesh.visible = gSignFace > 0;
        this.gasSignFaceMesh.count = gSignFace;
        this.gasSignFaceMesh.instanceMatrix.needsUpdate = gSignFace > 0;

        this.exitRampsMesh.visible = eRamp > 0;
        this.exitRampsMesh.count = eRamp;
        this.exitRampsMesh.instanceMatrix.needsUpdate = eRamp > 0;

        this.exitSignsMesh.visible = eSign > 0;
        this.exitSignsMesh.count = eSign;
        this.exitSignsMesh.instanceMatrix.needsUpdate = eSign > 0;

        this.crossStreetsMesh.visible = cStreet > 0;
        this.crossStreetsMesh.count = cStreet;
        this.crossStreetsMesh.instanceMatrix.needsUpdate = cStreet > 0;

        this.trafficSignalsMesh.visible = tSignal > 0;
        this.trafficSignalsMesh.count = tSignal;
        this.trafficSignalsMesh.instanceMatrix.needsUpdate = tSignal > 0;

        this.signalLensesMesh.visible = sLens > 0;
        this.signalLensesMesh.count = sLens;
        this.signalLensesMesh.instanceMatrix.needsUpdate = sLens > 0;

        const allInstanced = [
            this.buildingMesh, this.streetPolesMesh, this.streetArmsMesh, this.streetLampsMesh,
            this.streetLampGlowsMesh, this.streetLightPoolsMesh, this.palmTrunksMesh, this.palmFrondsMesh,
            this.tunnelArchesMesh, this.guardrailPostsMesh, this.guardrailBeamsMesh, this.guardrailReflectorsMesh,
            this.roadStudsMesh, this.overpassMesh, this.bridgePylonsMesh, this.bridgeBeaconsMesh,
            this.gasCanopyMesh, this.gasForecourtMesh, this.gasTotemMesh, this.gasSignFaceMesh,
            this.exitRampsMesh, this.exitSignsMesh, this.crossStreetsMesh, this.trafficSignalsMesh,
            this.signalLensesMesh
        ];
        for (const im of allInstanced) {
            if (im.count > 0) {
                im.computeBoundingSphere();
                im.computeBoundingBox();
            }
        }
    }

    private updateTerrainMesh(mesh: THREE.Mesh, side: number, worldZOffset: number = 0): void {
        const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
        const colAttr = mesh.geometry.attributes.color as THREE.BufferAttribute;
        const positions = posAttr.array as Float32Array;
        const colors = colAttr.array as Float32Array;
        const terrainStart = 7.4;
        const terrainWidth = 460;
        let idx = 0;

        for (let iz = 0; iz <= SEG_Z; iz++) {
            const t = iz / SEG_Z;
            const sceneZ = this.startZ + t * 500;
            const globalZ = sceneZ + worldZOffset;
            const roadInfo = Road.evaluateRoadPosition(globalZ);
            const cp = roadInfo.position;
            const normal = roadInfo.normal;

            for (let ix = 0; ix <= SEG_X; ix++) {
                const u = ix / SEG_X;
                const xDist = terrainStart + u * terrainWidth;
                const bx = cp.x + normal.x * (side * xDist);
                const bz = sceneZ + normal.z * (side * xDist);
                const bz_global = globalZ + normal.z * (side * xDist);

                // Multi-octave continuous elevation function shared across chunks & objects (Bug 3e & 3f)
                const by = SharedRoadAssets.computeTerrainElevation(bx, bz_global, cp.y, xDist);

                positions[idx] = bx;
                positions[idx + 1] = by;
                positions[idx + 2] = bz;

                // Rich vertex-color gradient: dark gravel shoulder -> mossy foothills -> twilight violet crests
                const relHeight = Math.max(0, by - cp.y);
                const heightFactor = Math.min(1.0, relHeight / 85.0);
                const distFactor = Math.pow(u, 0.7);

                // Base nocturnal earth / shoulder
                let r = 0.032 + heightFactor * 0.055 + distFactor * 0.025;
                let g = 0.038 + heightFactor * 0.035 + distFactor * 0.020;
                let b = 0.055 + heightFactor * 0.085 + distFactor * 0.045;

                // Hilltop ridge highlight catching horizon glow
                if (heightFactor > 0.45) {
                    const crest = (heightFactor - 0.45) * 1.8;
                    r += crest * 0.040;
                    b += crest * 0.050;
                }

                colors[idx] = r;
                colors[idx + 1] = g;
                colors[idx + 2] = b;

                idx += 3;
            }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.computeBoundingBox();
    }

    private shiftTerrainMesh(mesh: THREE.Mesh, offsetZ: number): void {
        const posAttr = mesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < posAttr.count; i++) {
            posAttr.setZ(i, posAttr.getZ(i) - offsetZ);
        }
        posAttr.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
        mesh.geometry.computeBoundingBox();
    }

    public shiftOrigin(offsetZ: number): void {
        this.startZ -= offsetZ;

        // Shift road surface geometry
        const roadPos = this.mesh.geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < roadPos.count; i++) {
            roadPos.setZ(i, roadPos.getZ(i) - offsetZ);
        }
        roadPos.needsUpdate = true;
        this.mesh.geometry.computeBoundingSphere();
        this.mesh.geometry.computeBoundingBox();

        // Shift road lines geometry
        const yellowPos = this.yellowLines.geometry.attributes.position as THREE.BufferAttribute;
        if (yellowPos) {
            for (let i = 0; i < yellowPos.count; i++) {
                yellowPos.setZ(i, yellowPos.getZ(i) - offsetZ);
            }
            yellowPos.needsUpdate = true;
            this.yellowLines.geometry.computeBoundingSphere();
            this.yellowLines.geometry.computeBoundingBox();
        }

        const whitePos = this.whiteLines.geometry.attributes.position as THREE.BufferAttribute;
        if (whitePos) {
            for (let i = 0; i < whitePos.count; i++) {
                whitePos.setZ(i, whitePos.getZ(i) - offsetZ);
            }
            whitePos.needsUpdate = true;
            this.whiteLines.geometry.computeBoundingSphere();
            this.whiteLines.geometry.computeBoundingBox();
        }

        // Shift terrain meshes
        this.shiftTerrainMesh(this.leftTerrainMesh, offsetZ);
        this.shiftTerrainMesh(this.rightTerrainMesh, offsetZ);

        // Shift CatmullRom curve points
        for (let i = 0; i < this.curve.points.length; i++) {
            this.curve.points[i].z -= offsetZ;
        }

        // Shift streetlight glow vectors
        for (let i = 0; i < this.streetlightGlows.length; i++) {
            this.streetlightGlows[i].z -= offsetZ;
        }

        // Shift neon signs
        for (let i = 0; i < this.neonSigns.length; i++) {
            this.neonSigns[i].position.z -= offsetZ;
        }

        // Shift instanced meshes
        const mat = new THREE.Matrix4();
        const instancedList = [
            this.buildingMesh, this.windowAmberMesh, this.windowGoldMesh, this.windowCyanMesh,
            this.streetPolesMesh, this.streetArmsMesh, this.streetLampsMesh, this.streetLampGlowsMesh,
            this.streetLightPoolsMesh, this.palmTrunksMesh, this.palmFrondsMesh, this.tunnelArchesMesh,
            this.guardrailPostsMesh, this.guardrailBeamsMesh, this.guardrailReflectorsMesh,
            this.roadStudsMesh, this.overpassMesh, this.bridgePylonsMesh, this.bridgeBeaconsMesh,
            this.gasCanopyMesh, this.gasForecourtMesh, this.gasTotemMesh, this.gasSignFaceMesh,
            this.exitRampsMesh, this.exitSignsMesh, this.crossStreetsMesh, this.trafficSignalsMesh,
            this.signalLensesMesh
        ];
        for (const im of instancedList) {
            if (im.count > 0) {
                for (let i = 0; i < im.count; i++) {
                    im.getMatrixAt(i, mat);
                    mat.elements[14] -= offsetZ;
                    im.setMatrixAt(i, mat);
                }
                im.instanceMatrix.needsUpdate = true;
                im.computeBoundingSphere();
                im.computeBoundingBox();
            }
        }
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
        const board = new THREE.Mesh(SharedRoadAssets.billboardBoardGeo, SharedRoadAssets.getBillboardMaterial(texIndex));
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
        this.streetLampGlowsMesh.dispose();
        this.streetLightPoolsMesh.dispose();
        this.palmTrunksMesh.dispose();
        this.palmFrondsMesh.dispose();
        this.tunnelArchesMesh.dispose();
        this.guardrailPostsMesh.dispose();
        this.guardrailBeamsMesh.dispose();
        this.guardrailReflectorsMesh.dispose();
        this.roadStudsMesh.dispose();
        this.overpassMesh.dispose();
        this.bridgePylonsMesh.dispose();
        this.bridgeBeaconsMesh.dispose();
        this.gasCanopyMesh.dispose();
        this.gasForecourtMesh.dispose();
        this.gasTotemMesh.dispose();
        this.gasSignFaceMesh.dispose();
        this.exitRampsMesh.dispose();
        this.exitSignsMesh.dispose();
        this.crossStreetsMesh.dispose();
        this.trafficSignalsMesh.dispose();
        this.signalLensesMesh.dispose();
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
    public worldZOffset: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.biomeManager = new BiomeManager();

        // Sleek wet asphalt highway surface (wet road roughness 0.25)
        this.material = new THREE.MeshStandardMaterial({
            color: 0x181c26,
            roughness: 0.25,
            metalness: 0.45,
            side: THREE.DoubleSide,
            envMapIntensity: 2.2,
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

        // Streetlights pool (Bug 3a: 6 PointLights #ffb35a, intensity ~25, distance 30, decay 2)
        for (let i = 0; i < 6; i++) {
            const light = new THREE.PointLight(0xffb35a, 25, 30, 2);
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
        this.waypoints.push(Road.evaluateRoadPosition(z).position);
    }

    private initPool(): void {
        for (let i = 0; i < 8; i++) {
            this.pool.push(new RoadChunk(this.material, this.yellowLineMat, this.whiteLineMat));
        }
    }

    private spawnInitialChunks(): void {
        for (let i = 0; i < 2; i++) {
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
        this.ensureWaypointsFor(z);
        const chunk = this.pool.pop() || new RoadChunk(this.material, this.yellowLineMat, this.whiteLineMat);
        const points: THREE.Vector3[] = [];
        for (let s = 0; s <= 4; s++) {
            const pz = z + s * 125;
            points.push(this.getRoadPositionAt(pz).position);
        }
        chunk.activate(z, points, this.scene, params, this.worldZOffset);
        this.scene.add(chunk.mesh, chunk.yellowLines, chunk.whiteLines, chunk.cityGroup);
        this.chunks.push(chunk);
    }

    public static evaluateRoadPosition(globalZ: number): { position: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3 } {
        const safeZ = Math.max(0, globalZ);

        // Gentle sweeping highway curves (curvature strictly < 1/400m, min R > 1000m)
        // Starts straight at origin (x(0)=0, dx/dz(0)=0) and smoothly sweeps into curves
        const w1 = 0.0020;
        const w2 = 0.0010;
        const w3 = 0.0007;
        const A1 = 120.0;
        const A2 = 72.0;

        const u1 = 1.0 - Math.cos(safeZ * w1);
        const s1 = Math.sin(safeZ * w2);
        const u2 = 1.0 - Math.cos(safeZ * w3);

        const x = u1 * A1 * s1 + u2 * A2;
        const dx = (w1 * Math.sin(safeZ * w1) * s1 + u1 * w2 * Math.cos(safeZ * w2)) * A1 + (w3 * Math.sin(safeZ * w3)) * A2;

        // Rising and falling highway grade (smooth undulations, max 3.8% slope)
        const wy1 = 0.0014;
        const wy2 = 0.0007;
        const uy1 = 1.0 - Math.cos(safeZ * wy1);
        const sy1 = Math.sin(safeZ * wy2);

        const y = uy1 * 24.0 * sy1;
        const dy = (wy1 * Math.sin(safeZ * wy1) * sy1 + uy1 * wy2 * Math.cos(safeZ * wy2)) * 24.0;

        const tangent = new THREE.Vector3(dx, dy, 1.0).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        return { position: new THREE.Vector3(x, y, safeZ), tangent, normal };
    }

    public getRoadPositionAt(z: number): { position: THREE.Vector3; tangent: THREE.Vector3 } {
        const globalZ = z + this.worldZOffset;
        const info = Road.evaluateRoadPosition(globalZ);
        return { position: new THREE.Vector3(info.position.x, info.position.y, z), tangent: info.tangent };
    }

    public update(carZ: number, carPos: THREE.Vector3, _carSpeed: number, delta: number, _config: QualityConfig): void {
        for (let i = 0; i < this.chunks.length; i++) {
            this.chunks[i].update(delta);
        }

        // 1. Recycle chunks behind player (continuous road: keeps coverage behind player >= 50m)
        while (this.chunks.length > 1 && (this.chunks[0].startZ + this.chunks[0].length) < carZ - 80) {
            const old = this.chunks.shift();
            if (old) {
                this.scene.remove(old.mesh, old.yellowLines, old.whiteLines, old.cityGroup);
                this.pool.push(old);
            }
        }

        // 2. Spawn chunks ahead until playerZ + VIEW_DISTANCE (continuous road: >= 600m ahead)
        const VIEW_DISTANCE = 700;
        while (this.chunks.length === 0 || (this.chunks[this.chunks.length - 1].startZ + this.chunks[this.chunks.length - 1].length) < carZ + VIEW_DISTANCE) {
            const nextZ = this.chunks.length === 0 ? Math.floor((carZ - 100) / 500) * 500 : this.chunks[this.chunks.length - 1].startZ + 500;
            this.spawnChunk(nextZ, this.biomeManager.getParamsAt(nextZ + this.worldZOffset));
        }

        // Re-assign the 6 PointLights to the 6 nearest lamps ahead of the player (Bug 3a)
        const candidates: { pos: THREE.Vector3; distSq: number }[] = [];
        for (let c = 0; c < this.chunks.length; c++) {
            const chunk = this.chunks[c];
            if (chunk.startZ + 500 >= carZ - 20 && chunk.startZ <= carZ + 350) {
                for (let g = 0; g < chunk.streetlightGlows.length; g++) {
                    const glowPos = chunk.streetlightGlows[g];
                    if (glowPos.z >= carZ - 10 && glowPos.z <= carZ + 250) {
                        const distSq = glowPos.distanceToSquared(carPos);
                        candidates.push({ pos: glowPos, distSq });
                    }
                }
            }
        }
        candidates.sort((a, b) => a.distSq - b.distSq);

        for (let i = 0; i < this.streetlights.length; i++) {
            if (i < candidates.length) {
                this.streetlights[i].position.copy(candidates[i].pos);
                this.streetlights[i].intensity = 25;
            } else {
                this.streetlights[i].intensity = 0;
            }
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
    }

    public shiftOrigin(offsetZ: number): void {
        this.worldZOffset += offsetZ;
        for (let i = 0; i < this.chunks.length; i++) {
            this.chunks[i].shiftOrigin(offsetZ);
        }
        for (let i = 0; i < this.waypoints.length; i++) {
            this.waypoints[i].z -= offsetZ;
        }
        for (let i = 0; i < this.streetlights.length; i++) {
            this.streetlights[i].position.z -= offsetZ;
        }
        for (let i = 0; i < this.neonLights.length; i++) {
            this.neonLights[i].position.z -= offsetZ;
        }
    }

    public getChunkTelemetry(carZ: number): {
        activeChunks: number;
        nearestDist: number;
        farthestDist: number;
        minZ: number;
        maxZ: number;
        isContinuous: boolean;
    } {
        if (this.chunks.length === 0) {
            return { activeChunks: 0, nearestDist: 0, farthestDist: 0, minZ: 0, maxZ: 0, isContinuous: false };
        }
        const minZ = this.chunks[0].startZ;
        const maxZ = this.chunks[this.chunks.length - 1].startZ + this.chunks[this.chunks.length - 1].length;
        const nearestDist = minZ - carZ;
        const farthestDist = maxZ - carZ;
        const isContinuous = (nearestDist <= -50) && (farthestDist >= 600);
        return {
            activeChunks: this.chunks.length,
            nearestDist,
            farthestDist,
            minZ,
            maxZ,
            isContinuous
        };
    }

    public logChunkDiagnostics(playerZ: number): void {
        console.log(`=== ROAD CHUNK DIAGNOSTICS (Player Z: ${playerZ.toFixed(1)}, World Offset: ${this.worldZOffset}m) ===`);
        this.chunks.forEach((chunk, index) => {
            const mesh = chunk.mesh;
            const bs = mesh.geometry.boundingSphere;
            const distToPlayer = (chunk.startZ + chunk.length * 0.5) - playerZ;
            console.log(`[Chunk #${index}] startZ: ${chunk.startZ}m, worldPos: (${mesh.position.x.toFixed(1)}, ${mesh.position.y.toFixed(1)}, ${mesh.position.z.toFixed(1)}), visible: ${mesh.visible}, parent: ${mesh.parent ? mesh.parent.type : 'none'}, frustumCulled: ${mesh.frustumCulled}, materials: ${Array.isArray(mesh.material) ? mesh.material.length : 1}, bsCenter: ${bs ? `(${bs.center.x.toFixed(1)}, ${bs.center.y.toFixed(1)}, ${bs.center.z.toFixed(1)})` : 'null'}, bsRadius: ${bs ? bs.radius.toFixed(1) : 'null'}, distToPlayer: ${distToPlayer.toFixed(1)}m`);
        });
    }

    public setRoadEnvMap(envMap: THREE.Texture): void {
        this.material.envMap = envMap;
        this.material.roughness = 0.25;
        this.material.metalness = 0.45;
        this.material.envMapIntensity = 2.2;
        this.material.needsUpdate = true;
    }

    public getRoadMeshes(): THREE.Object3D[] {
        return this.chunks.map(c => c.mesh);
    }
}
