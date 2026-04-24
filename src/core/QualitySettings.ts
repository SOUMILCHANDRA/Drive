/**
 * QualitySettings: Manages performance tiers and hardware benchmarking.
 */

export type QualityTier = 'LOW' | 'MEDIUM' | 'HIGH';

export interface QualityConfig {
    tier: QualityTier;
    bloom: boolean;
    rainCount: number;
    shadowSize: number;
    postProcessing: boolean;
    roadReflections: boolean;
    chunkLimit: number;
    fogDensity: number;
}

export const Tiers: Record<QualityTier, QualityConfig> = {
    LOW: {
        tier: 'LOW',
        bloom: false,
        rainCount: 0,
        shadowSize: 0,
        postProcessing: false,
        roadReflections: false,
        chunkLimit: 3,
        fogDensity: 0.003
    },
    MEDIUM: {
        tier: 'MEDIUM',
        bloom: true,
        rainCount: 8000,
        shadowSize: 512,
        postProcessing: true,
        roadReflections: true,
        chunkLimit: 5,
        fogDensity: 0.0018
    },
    HIGH: {
        tier: 'HIGH',
        bloom: true,
        rainCount: 15000,
        shadowSize: 2048,
        postProcessing: true,
        roadReflections: true,
        chunkLimit: 7,
        fogDensity: 0.0018
    }
};

export class QualityManager {
    private currentTier: QualityTier = 'HIGH';

    constructor() {
        const stored = localStorage.getItem('nightcall_quality') as QualityTier;
        if (stored && Tiers[stored]) {
            this.currentTier = stored;
        } else {
            this.autoDetect();
        }
    }

    private autoDetect(): void {
        // Simple heuristic: check for mobile or weak GPU
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        this.currentTier = isMobile ? 'LOW' : 'HIGH';
        localStorage.setItem('nightcall_quality', this.currentTier);
    }

    public setTier(tier: QualityTier): void {
        this.currentTier = tier;
        localStorage.setItem('nightcall_quality', tier);
    }

    public getConfig(): QualityConfig {
        return Tiers[this.currentTier];
    }
}
