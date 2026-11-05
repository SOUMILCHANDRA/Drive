import { Howl, Howler } from 'howler';

/**
 * SoundManager: Orchestrates procedural V8 synthesis, atmospheric rain,
 * dynamic vehicle near-misses & collision impact audio.
 */
export class SoundManager {
    private bgm: Howl | null = null;
    public masterVolume: number = 0.5;

    // Web Audio API components
    private ctx: AudioContext | null = null;
    private engineOsc!: OscillatorNode;
    private engineSubOsc!: OscillatorNode;
    private engineFilter!: BiquadFilterNode;
    private engineGain!: GainNode;
    private rainGain!: GainNode;
    private windGain!: GainNode;

    constructor() {
        this.masterVolume = parseFloat(localStorage.getItem('nightcall_volume') || '0.5');
    }

    private initWebAudio(): void {
        if (this.ctx) return;
        
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        
        // 🏎️ 1. Procedural V8 Engine Synthesis (Primary Rumble + Sub-Harmonic)
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 45; // Idle rumble
        
        this.engineSubOsc = this.ctx.createOscillator();
        this.engineSubOsc.type = 'triangle';
        this.engineSubOsc.frequency.value = 22.5;

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 480; // Low-pass filter for chase camera
        this.engineFilter.Q.value = 5.0;
        
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0; // Start silent
        
        this.engineOsc.connect(this.engineFilter);
        this.engineSubOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);

        this.engineOsc.start();
        this.engineSubOsc.start();

        // 🌧️ 2. Procedural Rain Ambience Bed
        this.rainGain = this.createRainAmbience(this.ctx);

        // 💨 3. Procedural Wind Loop that scales with speed
        this.windGain = this.createWindAmbience(this.ctx);
    }

    private createWindAmbience(ctx: AudioContext): GainNode {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0.0;
        // Generate pink noise for soft realistic air rush
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            lastOut = (lastOut + 0.02 * white) / 1.02;
            data[i] = lastOut * 0.75;
        }

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 650;
        filter.Q.value = 0.8;

        const gain = ctx.createGain();
        gain.gain.value = 0;

        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();

        return gain;
    }

    private createRainAmbience(ctx: AudioContext): GainNode {
        const bufferSize = ctx.sampleRate * 2;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.25;
        }
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1100;
        filter.Q.value = 0.6;
        
        const gain = ctx.createGain();
        gain.gain.value = 0;
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        
        return gain;
    }

    public async loadBGM(url: string): Promise<void> {
        return new Promise((resolve) => {
            try {
                this.bgm = new Howl({
                    src: [url],
                    loop: true,
                    html5: true,
                    volume: 0, 
                    onload: () => resolve(),
                    onloaderror: () => resolve() // Never hang initialization
                });
            } catch {
                resolve();
            }
        });
    }

    public playAll(): void {
        this.initWebAudio();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        if (this.bgm) {
            try {
                this.bgm.play();
                this.bgm.fade(0, 0.4 * this.masterVolume, 6000); 
            } catch {}
        }

        if (this.engineGain && this.ctx) {
            this.engineGain.gain.setTargetAtTime(0.08 * this.masterVolume, this.ctx.currentTime, 1.5);
        }
        if (this.rainGain && this.ctx) {
            this.rainGain.gain.setTargetAtTime(0.035 * this.masterVolume, this.ctx.currentTime, 3.0);
        }
    }

    public update(speed: number, _delta: number, isChaseCam: boolean = true, rainIntensity: number = 0.5): void {
        if (!this.ctx || !this.engineOsc) return;

        const speedKmh = speed * 3.6;
        // Engine hum pitch from RPM with a smooth curve
        const rpmNorm = Math.pow(Math.min(speedKmh / 160, 1.0), 0.78);
        const rpm = 800 + rpmNorm * 4600;
        const freq = 36 + (rpm / 6000) * 145;
        
        this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.08);
        this.engineSubOsc.frequency.setTargetAtTime(freq * 0.5, this.ctx.currentTime, 0.08);
        
        // Low-pass filter when in the chase camera (warm atmospheric rumble)
        if (this.engineFilter) {
            const filterCutoff = isChaseCam ? 480 : 1200;
            this.engineFilter.frequency.setTargetAtTime(filterCutoff, this.ctx.currentTime, 0.15);
        }

        const targetGain = (0.05 + (speedKmh / 180) * 0.07) * this.masterVolume;
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.08);

        // Soft wind loop that scales with speed
        if (this.windGain) {
            const windTarget = Math.pow(Math.min(speedKmh / 160, 1.0), 1.5) * 0.09 * this.masterVolume;
            this.windGain.gain.setTargetAtTime(windTarget, this.ctx.currentTime, 0.12);
        }

        // Soft rain bed
        if (this.rainGain) {
            const rainTarget = Math.max(0.01, rainIntensity) * 0.045 * this.masterVolume;
            this.rainGain.gain.setTargetAtTime(rainTarget, this.ctx.currentTime, 0.25);
        }
    }

    public playNearMiss(): void {
        if (!this.ctx || this.masterVolume <= 0.01) return;
        try {
            // High speed whoosh / Doppler effect
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            filter.type = 'bandpass';
            filter.Q.value = 3;

            const now = this.ctx.currentTime;
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(140, now + 0.35);

            filter.frequency.setValueAtTime(800, now);
            filter.frequency.exponentialRampToValueAtTime(250, now + 0.35);

            gain.gain.setValueAtTime(0.12 * this.masterVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.35);
        } catch {}
    }

    public playCollision(): void {
        if (!this.ctx || this.masterVolume <= 0.01) return;
        try {
            // Punchy low-end impact thump
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const now = this.ctx.currentTime;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(35, now + 0.4);

            gain.gain.setValueAtTime(0.35 * this.masterVolume, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now);
            osc.stop(now + 0.45);
        } catch {}
    }

    public setVolume(val: number): void {
        this.masterVolume = Math.max(0, Math.min(1, val));
        localStorage.setItem('nightcall_volume', this.masterVolume.toString());
        Howler.volume(this.masterVolume);
        
        if (this.ctx) {
            if (this.engineGain) this.engineGain.gain.setTargetAtTime(0.08 * this.masterVolume, this.ctx.currentTime, 0.3);
            if (this.rainGain) this.rainGain.gain.setTargetAtTime(0.035 * this.masterVolume, this.ctx.currentTime, 0.3);
            if (this.windGain) this.windGain.gain.setTargetAtTime(0.04 * this.masterVolume, this.ctx.currentTime, 0.3);
        }
    }
}
