import { Howl, Howler } from 'howler';

/**
 * SoundManager: Orchestrates the sparse, cinematic audio landscape of Nightcall.
 */
export class SoundManager {
    private bgm: Howl | null = null;
    private engineHum: Howl | null = null;
    private rainLoop: Howl | null = null;
    private cityAmbiance: Howl | null = null;
    
    public masterVolume: number = 0.5;

    constructor() {
        this.masterVolume = parseFloat(localStorage.getItem('nightcall_volume') || '0.5');
        this.initEffects();
    }

    private initEffects(): void {
        // 1. Engine Hum (Low Frequency Pulse)
        this.engineHum = new Howl({
            src: ['/audio/engine_hum.webm'],
            loop: true,
            volume: 0.15,
            rate: 0.6
        });

        // 2. Rain Ambience
        this.rainLoop = new Howl({
            src: ['/audio/rain_loop.webm'],
            loop: true,
            volume: 0.1
        });

        // 3. City Ambiance (Distant Sirens, Horns)
        this.cityAmbiance = new Howl({
            src: ['/audio/city_ambiance.webm'],
            loop: true,
            volume: 0.05
        });
    }

    public async loadBGM(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.bgm = new Howl({
                src: [url],
                loop: true,
                volume: 0, // Start silent for fade-in
                onload: () => resolve(),
                onloaderror: (_id, err) => reject(err)
            });
        });
    }

    public playAll(): void {
        if (this.bgm) {
            this.bgm.play();
            this.bgm.fade(0, 0.4 * this.masterVolume, 8000); // 8-second cinematic fade
        }
        if (this.engineHum) this.engineHum.play();
        if (this.rainLoop) this.rainLoop.play();
        if (this.cityAmbiance) this.cityAmbiance.play();
    }

    public update(speed: number, _delta: number): void {
        const speedFactor = speed / 40;

        // Dynamic Engine Pitching (0.6x at idle, 1.4x at max)
        if (this.engineHum) {
            const targetRate = 0.6 + speedFactor * 0.8;
            this.engineHum.rate(targetRate);
            // Increase hum volume slightly with speed
            this.engineHum.volume(0.1 + speedFactor * 0.1);
        }

        // Crossfade City Ambiance based on distance/speed (simulating highway isolation)
        if (this.cityAmbiance) {
            const ambianceVol = Math.max(0.01, 0.05 - speedFactor * 0.04);
            this.cityAmbiance.volume(ambianceVol);
        }
    }

    public setVolume(val: number): void {
        this.masterVolume = val;
        localStorage.setItem('nightcall_volume', val.toString());
        Howler.volume(val);
    }
}
