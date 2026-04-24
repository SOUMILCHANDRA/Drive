import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass } from 'three-stdlib';
import { FilmGrainShader, ChromaticAberrationShader, VignetteShader, LetterboxShader } from '../shaders/PostProcessingShaders';

import type { QualityConfig } from './QualitySettings';

/**
 * Renderer: Manages the WebGL context, cinematic post-processing, and window scaling.
 */
export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  
  public grainPass!: ShaderPass;
  public aberrationPass!: ShaderPass;
  private bloomPass!: UnrealBloomPass;
  private mirrorCamera: THREE.PerspectiveCamera;

  constructor(containerId: string, quality: QualityConfig) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error('Container not found');

    this.renderer = new THREE.WebGLRenderer({
      antialias: quality.tier !== 'LOW',
      powerPreference: 'high-performance',
    });
    
    this.renderer.setPixelRatio(quality.tier === 'HIGH' ? Math.min(window.devicePixelRatio, 2) : 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.shadowMap.enabled = quality.shadowSize > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060608);
    this.scene.fog = new THREE.FogExp2(0x0A0A14, quality.fogDensity);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 8000);
    this.mirrorCamera = new THREE.PerspectiveCamera(45, 350 / 65, 0.1, 1000);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.8, 0.8, 0.2);
    this.bloomPass.enabled = quality.bloom;
    this.composer.addPass(this.bloomPass);

    this.grainPass = new ShaderPass(FilmGrainShader);
    this.grainPass.enabled = quality.postProcessing;
    this.composer.addPass(this.grainPass);

    this.aberrationPass = new ShaderPass(ChromaticAberrationShader);
    this.aberrationPass.enabled = quality.postProcessing;
    this.composer.addPass(this.aberrationPass);

    this.composer.addPass(new ShaderPass(VignetteShader));
    this.composer.addPass(new ShaderPass(LetterboxShader));

    window.addEventListener('resize', () => this.onWindowResize());
  }

  public updateQuality(config: QualityConfig): void {
      this.renderer.shadowMap.enabled = config.shadowSize > 0;
      this.bloomPass.enabled = config.bloom;
      this.grainPass.enabled = config.postProcessing;
      this.aberrationPass.enabled = config.postProcessing;
      if (this.scene.fog instanceof THREE.FogExp2) {
          this.scene.fog.density = config.fogDensity;
      }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(delta: number, steer: number = 0): void {
    this.renderer.clear();
    // Update animated post-processing uniforms
    this.grainPass.uniforms.uTime.value += delta;
    
    // Dynamic Aberration (increases on sharp turns)
    const targetAberration = 0.002 + Math.abs(steer) * 0.006;
    this.aberrationPass.uniforms.uIntensity.value = THREE.MathUtils.lerp(
        this.aberrationPass.uniforms.uIntensity.value,
        targetAberration,
        0.1
    );

    this.composer.render();
  }

  public renderMirror(car: THREE.Group): void {
    if (!car) return;
    
    // Position mirror camera behind car, looking back
    this.mirrorCamera.position.copy(car.position).add(new THREE.Vector3(0, 1.5, -2).applyQuaternion(car.quaternion));
    const lookTarget = car.position.clone().add(new THREE.Vector3(0, 1.5, -50).applyQuaternion(car.quaternion));
    this.mirrorCamera.lookAt(lookTarget);

    const width = 350;
    const height = 65;
    const left = (window.innerWidth - width) / 2;
    const bottom = window.innerHeight - (window.innerHeight * 0.105) - height - 15; // 10.5vh + padding

    this.renderer.setViewport(left, bottom, width, height);
    this.renderer.setScissor(left, bottom, width, height);
    this.renderer.setScissorTest(true);
    
    this.renderer.render(this.scene, this.mirrorCamera);

    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  }
}
