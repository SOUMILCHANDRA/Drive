import * as THREE from 'three';

export interface BiomeParams {
    name: string;
    buildingDensity: number;
    buildingHeight: [number, number];
    neonDensity: number;
    streetlightSpacing: number;
    fogDensity: number;
    ambientIntensity: number;
    rainIntensity: number;
}

export const Biomes: Record<string, BiomeParams> = {
    DOWNTOWN: {
        name: 'DOWNTOWN',
        buildingDensity: 0.9,
        buildingHeight: [30, 80],
        neonDensity: 0.8,
        streetlightSpacing: 40,
        fogDensity: 0.002,
        ambientIntensity: 0.15,
        rainIntensity: 1.0
    },
    MIDTOWN: {
        name: 'MIDTOWN',
        buildingDensity: 0.6,
        buildingHeight: [15, 40],
        neonDensity: 0.4,
        streetlightSpacing: 60,
        fogDensity: 0.0015,
        ambientIntensity: 0.1,
        rainIntensity: 0.8
    },
    INDUSTRIAL: {
        name: 'INDUSTRIAL',
        buildingDensity: 0.3,
        buildingHeight: [8, 15],
        neonDensity: 0.1,
        streetlightSpacing: 100,
        fogDensity: 0.0018,
        ambientIntensity: 0.08,
        rainIntensity: 1.0
    },
    HIGHWAY: {
        name: 'HIGHWAY',
        buildingDensity: 0.05,
        buildingHeight: [5, 10],
        neonDensity: 0.02,
        streetlightSpacing: 150,
        fogDensity: 0.001,
        ambientIntensity: 0.05,
        rainIntensity: 0.6
    },
    TUNNEL: {
        name: 'TUNNEL',
        buildingDensity: 0,
        buildingHeight: [0, 0],
        neonDensity: 0,
        streetlightSpacing: 30,
        fogDensity: 0.004,
        ambientIntensity: 0.2, // Orange sodium glow
        rainIntensity: 0
    }
};

interface BiomeSection {
    type: BiomeParams;
    start: number;
    length: number;
}

export class BiomeManager {
    private sequence: BiomeSection[] = [];

    constructor() {
        this.generateNextSection(0);
        this.generateNextSection(this.sequence[0].length);
    }

    private generateNextSection(start: number): void {
        const types = Object.values(Biomes);
        let nextType = types[Math.floor(Math.random() * types.length)];
        
        // Avoid same biome twice in a row
        if (this.sequence.length > 0) {
            while (nextType.name === this.sequence[this.sequence.length - 1].type.name) {
                nextType = types[Math.floor(Math.random() * types.length)];
            }
        }

        const length = 1500 + Math.random() * 2000;
        this.sequence.push({ type: nextType, start, length });
    }

    public getParamsAt(z: number): BiomeParams {
        // Ensure we have enough sequence
        if (z > this.sequence[this.sequence.length - 1].start - 2000) {
            const last = this.sequence[this.sequence.length - 1];
            this.generateNextSection(last.start + last.length);
        }

        const idx = this.sequence.findIndex(s => z >= s.start && z < s.start + s.length);
        if (idx === -1) return Biomes.HIGHWAY;

        const current = this.sequence[idx];
        const next = this.sequence[idx + 1];

        if (!next) return current.type;

        // Transition Logic (300 units)
        const transitionStart = current.start + current.length - 300;
        if (z > transitionStart) {
            const t = (z - transitionStart) / 300;
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
                THREE.MathUtils.lerp(a.buildingHeight[1], b.buildingHeight[1], t)
            ],
            neonDensity: THREE.MathUtils.lerp(a.neonDensity, b.neonDensity, t),
            streetlightSpacing: THREE.MathUtils.lerp(a.streetlightSpacing, b.streetlightSpacing, t),
            fogDensity: THREE.MathUtils.lerp(a.fogDensity, b.fogDensity, t),
            ambientIntensity: THREE.MathUtils.lerp(a.ambientIntensity, b.ambientIntensity, t),
            rainIntensity: THREE.MathUtils.lerp(a.rainIntensity, b.rainIntensity, t)
        };
    }
}
