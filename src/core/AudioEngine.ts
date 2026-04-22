export class AudioEngine {
  private ctx: AudioContext;
  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  public init() {
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    // Engine Tone
    this.engineOsc = this.ctx.createOscillator();
    this.engineGain = this.ctx.createGain();
    
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.setValueAtTime(80, this.ctx.currentTime);
    this.engineGain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    
    // Filter for a smoother engine sound
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, this.ctx.currentTime);

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    
    this.engineOsc.start();
  }

  public update(speed: number) {
    if (!this.engineOsc || !this.engineGain) return;
    
    // Frequency maps from 80Hz (0km/h) to 400Hz (max)
    const freq = 80 + (speed * 4);
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    
    // Volume increases with speed
    const vol = 0.02 + (speed / 100) * 0.05;
    this.engineGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.1);
  }

  public playBoost() {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, this.ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }
}
