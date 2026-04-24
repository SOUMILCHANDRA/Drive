import { Howl, Howler } from 'howler';

/**
 * SoundManager: Orchestrates procedural synthesis and cinematic BGM for Nightcall.
 */
export class SoundManager {
    private bgm: Howl | null = null;
    public masterVolume: number = 0.5;

    // Web Audio API components
    private ctx: AudioContext | null = null;
    private engineOsc!: OscillatorNode;
    private engineGain!: GainNode;
    private rainGain!: GainNode;

    constructor() {
        this.masterVolume = parseFloat(localStorage.getItem('nightcall_volume') || '0.5');
    }

    private initWebAudio(): void {
        if (this.ctx) return;
        
        this.ctx = new AudioContext();
        
        // 🏎️ 1. Procedural Engine Synthesis
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 55; // Idle
        
        const engineFilter = this.ctx.createBiquadFilter();
        engineFilter.type = 'lowpass';
        engineFilter.frequency.value = 400;
        engineFilter.Q.value = 8;
        
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0; // Start silent
        
        this.engineOsc.connect(engineFilter);
        engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();

        // 🌧️ 2. Procedural Rain Ambience
        this.rainGain = this.createRainAmbience(this.ctx);
    }

    private createRainAmbience(ctx: AudioContext): GainNode {
        const bufferSize = ctx.sampleRate * 4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.3;
        }
        
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 0.5;
        
        const gain = ctx.createGain();
        gain.gain.value = 0; // Start silent
        
        source.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        source.start();
        
        return gain;
    }

    public async loadBGM(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.bgm = new Howl({
                src: [url],
                loop: true,
                volume: 0, 
                onload: () => resolve(),
                onloaderror: (_id, err) => reject(err)
            });
        });
    }

    public playAll(): void {
        this.initWebAudio();
        if (this.ctx) this.ctx.resume();

        if (this.bgm) {
            this.bgm.play();
            this.bgm.fade(0, 0.4 * this.masterVolume, 8000); 
        }

        // Fade in procedural elements
        if (this.engineGain) {
            this.engineGain.gain.setTargetAtTime(0.08 * this.masterVolume, this.ctx!.currentTime, 2);
        }
        if (this.rainGain) {
            this.rainGain.gain.setTargetAtTime(0.04 * this.masterVolume, this.ctx!.currentTime, 4);
        }
    }

    public update(speed: number, _delta: number): void {
        if (!this.ctx || !this.engineOsc) return;

        // Map speed 0–144 km/h to frequency 55Hz–220Hz
        const speedKmh = speed * 3.6; // Convert m/s to km/h
        const freq = 55 + (Math.min(speedKmh, 180) / 180) * 165;
        
        this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
        
        // Slightly increase gain with RPM
        const targetGain = (0.06 + (speedKmh / 180) * 0.06) * this.masterVolume;
        this.engineGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.1);
    }

    public setVolume(val: number): void {
        this.masterVolume = val;
        localStorage.setItem('nightcall_volume', val.toString());
        Howler.volume(val);
        
        if (this.ctx) {
            if (this.engineGain) this.engineGain.gain.setTargetAtTime(0.08 * val, this.ctx.currentTime, 0.5);
            if (this.rainGain) this.rainGain.gain.setTargetAtTime(0.04 * val, this.ctx.currentTime, 0.5);
        }
    }
}
