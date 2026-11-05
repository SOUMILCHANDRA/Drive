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
        buildingDensity: 0.65,
        buildingHeight: [25, 65],
        neonDensity: 0.55,
        streetlightSpacing: 40,
        fogDensity: 0.00048,
        fogColor: 0x2e1538,
        skyColor: 0x050a1e,
        ambientIntensity: 1.0,
        rainIntensity: 0.8,
        hasPalms: true,
    },
    BRIDGE: {
        name: 'THE BRIDGE',
        buildingDensity: 0.0,
        buildingHeight: [0, 0],
        neonDensity: 0.0,
        streetlightSpacing: 45,
        fogDensity: 0.00055,
        fogColor: 0x241432,
        skyColor: 0x04081c,
        ambientIntensity: 0.90,
        rainIntensity: 0.4,
        hasPalms: false,
    },
    TUNNEL: {
        name: 'THE TUNNEL',
        buildingDensity: 0,
        buildingHeight: [0, 0],
        neonDensity: 0,
        streetlightSpacing: 25,
        fogDensity: 0.0016,
        fogColor: 0x160c1e,
        skyColor: 0x02030a,
        ambientIntensity: 1.15,
        rainIntensity: 0,
        hasPalms: false,
    },
    GAS_STATION: {
        name: 'GAS STATION OASIS',
        buildingDensity: 0.18,
        buildingHeight: [10, 20],
        neonDensity: 0.85,
        streetlightSpacing: 45,
        fogDensity: 0.00045,
        fogColor: 0x32163c,
        skyColor: 0x060922,
        ambientIntensity: 1.05,
        rainIntensity: 0.2,
        hasPalms: true,
    },
    CANYON: {
        name: 'CANYON',
        buildingDensity: 0.0,
        buildingHeight: [0, 0],
        neonDensity: 0.0,
        streetlightSpacing: 90,
        fogDensity: 0.00042,
        fogColor: 0x26122f,
        skyColor: 0x04081a,
        ambientIntensity: 0.95,
        rainIntensity: 0.0,
        hasPalms: true,
    },
    NEON_COAST: {
        name: 'NEON COAST',
        buildingDensity: 0.25,
        buildingHeight: [10, 24],
        neonDensity: 0.70,
        streetlightSpacing: 50,
        fogDensity: 0.00045,
        fogColor: 0x30153a,
        skyColor: 0x060b24,
        ambientIntensity: 1.0,
        rainIntensity: 0.3,
        hasPalms: true,
    },
    INDUSTRIAL: {
        name: 'INDUSTRIAL',
        buildingDensity: 0.30,
        buildingHeight: [10, 20],
        neonDensity: 0.12,
        streetlightSpacing: 80,
        fogDensity: 0.00055,
        fogColor: 0x22122b,
        skyColor: 0x05091c,
        ambientIntensity: 0.9,
        rainIntensity: 1.0,
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
    private landmarkOrder = [
        Biomes.DOWNTOWN,
        Biomes.BRIDGE,
        Biomes.TUNNEL,
        Biomes.GAS_STATION,
    ];

    constructor() {
        this.sequence.push({ type: Biomes.DOWNTOWN, start: 0, length: 1500 });
        this.generateNextSection(1500);
        this.generateNextSection(3000);
    }

    private generateNextSection(start: number): void {
        const step = Math.floor(start / 1500);
        const nextType = this.landmarkOrder[step % this.landmarkOrder.length];
        const length = 1500;
        this.sequence.push({ type: nextType, start, length });
    }

    public getParamsAt(z: number): BiomeParams {
        if (z > this.sequence[this.sequence.length - 1].start - 2000) {
            const last = this.sequence[this.sequence.length - 1];
            this.generateNextSection(last.start + last.length);
        }

        const idx = this.sequence.findIndex(s => z >= s.start && z < s.start + s.length);
        if (idx === -1) return Biomes.CANYON;

        const current = this.sequence[idx];
        const next = this.sequence[idx + 1];

        if (!next) return current.type;

        const transitionStart = current.start + current.length - 250;
        if (z > transitionStart) {
            const t = (z - transitionStart) / 250;
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
