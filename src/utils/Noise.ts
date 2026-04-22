import { Alea } from './Alea';

/**
 * Procedural Noise generator implementing Perlin Noise and Fractal Brownian Motion (fBM).
 * Uses a deterministic Alea PRNG for reproducible world generation.
 */
export class Noise {
  private alea: Alea;
  private p: Uint8Array;

  constructor(seed: number = 42) {
    this.alea = new Alea(seed);
    this.p = new Uint8Array(512);
    const permutation = new Uint8Array(256);
    for (let i = 0; i < 256; i++) permutation[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(this.alea.next() * (i + 1));
      [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
    }
    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i & 255];
    }
  }

  public fbm(x: number, y: number, octaves: number, persistence: number, scale: number): number {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
      total += this.get(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }
    return total / maxValue;
  }

  public get(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    
    const u = this.fade(xf);
    const v = this.fade(yf);

    const a = this.p[X] + Y;
    const aa = this.p[a];
    const ab = this.p[a + 1];
    const b = this.p[X + 1] + Y;
    const ba = this.p[b];
    const bb = this.p[b + 1];

    const res = this.lerp(v, this.lerp(u, this.grad(this.p[aa], xf, yf), this.grad(this.p[ba], xf - 1, yf)),
                             this.lerp(u, this.grad(this.p[ab], xf, yf - 1), this.grad(this.p[bb], xf - 1, yf - 1)));
    return (res + 1) / 2;
  }

  private fade(t: number): number { return t * t * t * (t * (t * 6 - 15) + 10); }
  private lerp(t: number, a: number, b: number): number { return a + t * (b - a); }
  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const gradX = 1 + (h & 7); // Gradient value 1-8
    const gradY = (h & 8) === 0 ? gradX : -gradX;
    return ((h & 1) === 0 ? x : -x) * gradX + ((h & 2) === 0 ? y : -y) * gradY;
  }
}
