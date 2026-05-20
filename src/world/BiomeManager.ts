import * as THREE from 'three';

export interface BiomeParams {
    name: string;
    buildingDensity: number;
    buildingHeight: [number, number];
    neonDensity: number;
    streetlightSpacing: number;
    fogDensity: number;
    fogColor: number;
    skyColor: number;
    ambientIntensity: number;
    rainIntensity: number;
    hasPalms: boolean;
}

export const Biomes: Record<string, BiomeParams> = {
    DOWNTOWN: {
        name: 'DOWNTOWN',
        buildingDensity: 0.85,
        buildingHeight: [25, 70],
        neonDensity: 0.5,
        streetlightSpacing: 40,
        fogDensity: 0.0018,
        fogColor: 0x1a0e04,
        skyColor: 0x0d0602,
        ambientIntensity: 0.18,
        rainIntensity: 0.8,
        hasPalms: false,
    },
    CANYON: {
        name: 'CANYON',
        buildingDensity: 0.0,
        buildingHeight: [0, 0],
        neonDensity: 0.0,
        streetlightSpacing: 140,
        fogDensity: 0.0006,
        fogColor: 0x0d0800,
        skyColor: 0x060300,
        ambientIntensity: 0.07,
        rainIntensity: 0.0,
        hasPalms: true,
    },
    NEON_COAST: {
        name: 'NEON COAST',
        buildingDensity: 0.28,
        buildingHeight: [8, 22],
        neonDensity: 0.65,
        streetlightSpacing: 55,
        fogDensity: 0.0011,
        fogColor: 0x120a02,
        skyColor: 0x080400,
        ambientIntensity: 0.14,
        rainIntensity: 0.3,
        hasPalms: true,
    },
    INDUSTRIAL: {
        name: 'INDUSTRIAL',
        buildingDensity: 0.35,
        buildingHeight: [8, 18],
        neonDensity: 0.08,
        streetlightSpacing: 100,
        fogDensity: 0.0022,
        fogColor: 0x150900,
        skyColor: 0x080400,
        ambientIntensity: 0.09,
        rainIntensity: 1.0,
        hasPalms: false,
    },
    TUNNEL: {
        name: 'TUNNEL',
        buildingDensity: 0,
        buildingHeight: [0, 0],
        neonDensity: 0,
        streetlightSpacing: 25,
        fogDensity: 0.004,
        fogColor: 0x0d0800,
        skyColor: 0x000000,
        ambientIntensity: 0.22,
        rainIntensity: 0,
        hasPalms: false,
    },
};

interface BiomeSection {
    type: BiomeParams;
    start: number;
    length: number;
}

export class BiomeManager {
    private sequence: BiomeSection[] = [];

    constructor() {
        // Always start in DOWNTOWN
        this.sequence.push({ type: Biomes.DOWNTOWN, start: 0, length: 2000 });
        this.generateNextSection(2000);
        this.generateNextSection(this.sequence[1].start + this.sequence[1].length);
    }

    private generateNextSection(start: number): void {
        // Weighted pool — more canyon/coast to keep that Drive highway feel
        const pool = [
            Biomes.CANYON, Biomes.CANYON, Biomes.CANYON,
            Biomes.NEON_COAST, Biomes.NEON_COAST,
            Biomes.DOWNTOWN,
            Biomes.INDUSTRIAL,
            Biomes.TUNNEL,
        ];
        let nextType = pool[Math.floor(Math.random() * pool.length)];

        // Avoid same biome twice in a row
        if (this.sequence.length > 0) {
            let attempts = 0;
            while (nextType.name === this.sequence[this.sequence.length - 1].type.name && attempts < 10) {
                nextType = pool[Math.floor(Math.random() * pool.length)];
                attempts++;
            }
        }

        const length = 1800 + Math.random() * 2500;
        this.sequence.push({ type: nextType, start, length });
    }

    public getParamsAt(z: number): BiomeParams {
        // Ensure we have lookahead
        if (z > this.sequence[this.sequence.length - 1].start - 2000) {
            const last = this.sequence[this.sequence.length - 1];
            this.generateNextSection(last.start + last.length);
        }

        const idx = this.sequence.findIndex(s => z >= s.start && z < s.start + s.length);
        if (idx === -1) return Biomes.CANYON;

        const current = this.sequence[idx];
        const next = this.sequence[idx + 1];

        if (!next) return current.type;

        // 400-unit transition zone
        const transitionStart = current.start + current.length - 400;
        if (z > transitionStart) {
            const t = (z - transitionStart) / 400;
            return this.lerpBiomes(current.type, next.type, t);
        }

        return current.type;
    }

    private lerpBiomes(a: BiomeParams, b: BiomeParams, t: number): BiomeParams {
        return {
            name: t > 0.5 ? b.name : a.name,
            buildingDensity: THREE.MathUtils.lerp(a.buildingDensity, b.buildingDensity, t),
            buildingHeight: [
                THREE.MathUtils.lerp(a.buildingHeight[0], b.buildingHeight[0], t),
                THREE.MathUtils.lerp(a.buildingHeight[1], b.buildingHeight[1], t),
            ],
            neonDensity: THREE.MathUtils.lerp(a.neonDensity, b.neonDensity, t),
            streetlightSpacing: THREE.MathUtils.lerp(a.streetlightSpacing, b.streetlightSpacing, t),
            fogDensity: THREE.MathUtils.lerp(a.fogDensity, b.fogDensity, t),
            fogColor: t > 0.5 ? b.fogColor : a.fogColor,
            skyColor: t > 0.5 ? b.skyColor : a.skyColor,
            ambientIntensity: THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, t),
            rainIntensity: THREE.MathUtils.lerp(a.rainIntensity, b.rainIntensity, t),
            hasPalms: t > 0.5 ? b.hasPalms : a.hasPalms,
        };
    }
}
