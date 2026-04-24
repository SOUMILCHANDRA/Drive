import * as THREE from 'three';

/**
 * NeonSign: A living, flickering light source for the Nightcall city.
 */
export class NeonSign extends THREE.Group {
  private tubes: THREE.Mesh[] = [];
  private pointLight: THREE.PointLight;
  private baseIntensity: number;
  private flickerState: number = 1.0;
  private isBroken: boolean = Math.random() > 0.8; // Some signs are "broken"

  private static COLORS = [0xFF2D78, 0x00FFEF, 0xF4B942, 0x39FF14, 0x9B59B6];
  private static TEXTS = ["MOTEL", "BAR", "OPEN", "EATS", "HOTEL", "GIRLS", "PAWN", "24HR", "GAS", "PARKING"];

  constructor() {
    super();
    const color = NeonSign.COLORS[Math.floor(Math.random() * NeonSign.COLORS.length)];
    const text = NeonSign.TEXTS[Math.floor(Math.random() * NeonSign.TEXTS.length)];
    
    // 1. Backing Board
    const board = new THREE.Mesh(
        new THREE.BoxGeometry(text.length * 1.5, 3, 0.5),
        new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1.0 })
    );
    this.add(board);

    // 2. Neon Tubes (Text Representation)
    // We'll use a simple boxy path for the letters
    const material = new THREE.MeshStandardMaterial({
        color: color,
        emissive: color,
        emissiveIntensity: 10,
        toneMapped: false
    });

    for (let i = 0; i < text.length; i++) {
        const letterGeo = new THREE.BoxGeometry(1, 2, 0.1);
        const letter = new THREE.Mesh(letterGeo, material);
        letter.position.set(-(text.length * 0.75) + (i * 1.5) + 0.75, 0, 0.3);
        this.add(letter);
        this.tubes.push(letter);
    }

    // 3. Point Light (Splash Effect)
    this.baseIntensity = 2.0 + Math.random() * 2;
    this.pointLight = new THREE.PointLight(color, this.baseIntensity, 30);
    this.pointLight.position.set(0, 0, 1.5);
    this.add(this.pointLight);
  }

  public update(_delta: number): void {
    // Randomized Flicker Logic
    const time = Date.now() * 0.001;
    
    // Global "buzz"
    this.flickerState = 0.9 + Math.sin(time * 50) * 0.1;

    // Occasional deep flicker
    if (Math.random() > 0.99) {
        this.flickerState = 0.2;
    }

    // Broken neon logic (one letter flickers more)
    if (this.isBroken) {
        const brokenIdx = 0; // Fix first letter as broken
        const brokenFlicker = Math.random() > 0.1 ? 1.0 : 0.0;
        (this.tubes[brokenIdx].material as THREE.MeshStandardMaterial).emissiveIntensity = brokenFlicker * 15;
    }

    // Apply intensities
    this.pointLight.intensity = this.baseIntensity * this.flickerState;
    this.tubes.forEach((t, i) => {
        if (this.isBroken && i === 0) return;
        (t.material as THREE.MeshStandardMaterial).emissiveIntensity = this.flickerState * 12;
    });
  }
}
