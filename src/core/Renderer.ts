import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three-stdlib';

/**
 * Renderer: Handles WebGL2 setup and Cinematic Post-Processing.
 */
export class Renderer {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public composer: EffectComposer;

  constructor(containerId: string) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error(`Container #${containerId} not found`);

    // 1. WebGL2 Renderer Setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // 2. ACES Filmic Tone Mapping
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0A0A0F);
    this.scene.fog = new THREE.FogExp2(0x2A3040, 0.005);

    // 3. Cinematic Camera (FOV 55 as requested)
    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 8000);
    this.camera.position.set(0, 2, -10);

    // 4. EffectComposer Pipeline
    this.composer = new EffectComposer(this.renderer);
    const renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.8, 0.4, 0.85
    );
    this.composer.addPass(bloomPass);

    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    this.composer.render();
  }
}
