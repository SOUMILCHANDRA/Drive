import { createNoise2D } from 'simplex-noise';

export class Noise {
  private noise2D: (x: number, y: number) => number;

  constructor(seed: number = Math.random()) {
    // Basic seeded noise implementation or use the library
    this.noise2D = createNoise2D(() => seed);
  }

  public get(x: number, z: number, octaves: number = 4, persistence: number = 0.5, scale: number = 0.01): number {
    let total = 0;
    let frequency = scale;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    }

    return total / maxValue;
  }
}
