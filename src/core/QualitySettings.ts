/**
 * QualitySettings: Manages performance tiers and hardware scalability.
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
        fogDensity: 0.0025
    },
    MEDIUM: {
        tier: 'MEDIUM',
        bloom: true,
        rainCount: 2000,
        shadowSize: 512,
        postProcessing: true,
        roadReflections: true,
        chunkLimit: 4,
        fogDensity: 0.0016
    },
    HIGH: {
        tier: 'HIGH',
        bloom: true,
        rainCount: 4000,
        shadowSize: 1024,
        postProcessing: true,
        roadReflections: true,
        chunkLimit: 5,
        fogDensity: 0.0012
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
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        this.currentTier = isMobile ? 'LOW' : 'HIGH';
        localStorage.setItem('nightcall_quality', this.currentTier);
    }

    public setTier(tier: QualityTier): void {
        if (Tiers[tier]) {
            this.currentTier = tier;
            localStorage.setItem('nightcall_quality', tier);
        }
    }

    public getTier(): QualityTier {
        return this.currentTier;
    }

    public getConfig(): QualityConfig {
        return Tiers[this.currentTier];
    }
}
