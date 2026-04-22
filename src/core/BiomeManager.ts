import { CONFIG } from '../config';

export type BiomeType = 'LOWLANDS' | 'FOOTHILLS' | 'PEAKS';

export class BiomeManager {
    public static getBiome(z: number): BiomeType {
        const cycle = CONFIG.BIOMES.CYCLE_DISTANCE;
        const normalized = (Math.abs(z) % (cycle * 3)) / cycle;

        if (normalized < 1) return 'LOWLANDS';
        if (normalized < 2) return 'FOOTHILLS';
        return 'PEAKS';
    }

    public static getParams(z: number) {
        const type = this.getBiome(z);
        return CONFIG.BIOMES[type];
    }
}
