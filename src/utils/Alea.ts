export class Alea {
  private s0: number;
  private s1: number;
  private s2: number;
  private c: number;

  constructor(seed: any = 42) {
    let mash = this.createMash();
    this.s0 = mash(' ');
    this.s1 = mash(' ');
    this.s2 = mash(' ');
    this.c = 1;

    this.s0 -= mash(seed);
    if (this.s0 < 0) this.s0 += 1;
    this.s1 -= mash(seed);
    if (this.s1 < 0) this.s1 += 1;
    this.s2 -= mash(seed);
    if (this.s2 < 0) this.s2 += 1;
  }

  public next(): number {
    let t = 2091639 * this.s0 + this.c * 2.3283064365386963e-10; // 2^-32
    this.s0 = this.s1;
    this.s1 = this.s2;
    return this.s2 = t - (this.c = t | 0);
  }

  private createMash() {
    let n = 0xefc8249d;
    return (data: any) => {
      data = data.toString();
      for (let i = 0; i < data.length; i++) {
        n += data.charCodeAt(i);
        let h = 0.02519603282416938 * n;
        n = h >>> 0;
        h -= n;
        h *= n;
        n = h >>> 0;
        h -= n;
        n += h * 0x100000000; // 2^32
      }
      return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
    };
  }
}
