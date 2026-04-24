import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass } from 'three-stdlib';
import { FilmGrainShader, ChromaticAberrationShader, VignetteShader } from '../shaders/PostProcessingShaders';

import type { QualityConfig } from './QualitySettings';

/**
 * Renderer: Manages the WebGL context, cinematic post-processing, and real-time reflections.
 */
export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  
  public grainPass!: ShaderPass;
  public aberrationPass!: ShaderPass;
  private bloomPass!: UnrealBloomPass;
  private vignettePass!: ShaderPass;
  private mirrorCamera: THREE.PerspectiveCamera;

  // Road Mirror System
  private cubeRenderTarget!: THREE.WebGLCubeRenderTarget;
  private cubeCamera!: THREE.CubeCamera;
  private roadMirror!: THREE.Mesh;
  private frameCount: number = 0;

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
    this.renderer.toneMappingExposure = 1.4; 
    
    this.renderer.shadowMap.enabled = quality.shadowSize > 0;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = false;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060608);
    this.scene.fog = new THREE.FogExp2(0x0a0a14, 0.0012);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 3000);
    this.mirrorCamera = new THREE.PerspectiveCamera(45, 350 / 65, 0.1, 1000);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.5, 0.35);
    this.bloomPass.enabled = quality.bloom;
    this.composer.addPass(this.bloomPass);

    this.grainPass = new ShaderPass(FilmGrainShader);
    this.grainPass.uniforms.uIntensity.value = 0.025;
    this.grainPass.enabled = quality.postProcessing;
    this.composer.addPass(this.grainPass);

    this.aberrationPass = new ShaderPass(ChromaticAberrationShader);
    this.aberrationPass.enabled = quality.postProcessing;
    this.composer.addPass(this.aberrationPass);

    this.vignettePass = new ShaderPass(VignetteShader);
    this.vignettePass.uniforms.uDarkness.value = 0.5;
    this.vignettePass.uniforms.uOffset.value = 0.3;
    this.composer.addPass(this.vignettePass);

    this.setupRoadMirror();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupRoadMirror(): void {
      this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128, {
          generateMipmaps: true,
          minFilter: THREE.LinearMipmapLinearFilter,
      });
      this.cubeCamera = new THREE.CubeCamera(0.1, 200, this.cubeRenderTarget);
      this.scene.add(this.cubeCamera);

      const mirrorGeo = new THREE.PlaneGeometry(16, 80);
      const mirrorMat = new THREE.MeshStandardMaterial({
          color: 0x050508,
          roughness: 0.05,
          metalness: 0.9,
          envMap: this.cubeRenderTarget.texture,
          envMapIntensity: 1.5,
      });

      this.roadMirror = new THREE.Mesh(mirrorGeo, mirrorMat);
      this.roadMirror.rotation.x = -Math.PI / 2;
      this.roadMirror.position.y = 0.02; 
      this.scene.add(this.roadMirror);
  }

  public updateRoadMirror(carPos: THREE.Vector3): void {
      this.frameCount++;
      
      // Update at 15Hz (assuming 60fps) to save GPU budget
      if (this.frameCount % 4 === 0) {
          this.roadMirror.visible = false; 
          this.cubeCamera.position.copy(carPos);
          this.cubeCamera.position.y = 0.5;
          this.cubeCamera.update(this.renderer, this.scene);
          this.roadMirror.visible = true;
      }
      
      this.roadMirror.position.x = carPos.x;
      this.roadMirror.position.z = carPos.z + 10; // Slightly ahead for cinematic reflection
  }

  public updateQuality(config: QualityConfig): void {
      this.renderer.shadowMap.enabled = config.shadowSize > 0;
      this.bloomPass.enabled = config.bloom;
      this.grainPass.enabled = config.postProcessing;
      this.aberrationPass.enabled = config.postProcessing;
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(delta: number, steer: number = 0): void {
    this.renderer.clear();
    this.grainPass.uniforms.uTime.value += delta;
    
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
    this.mirrorCamera.position.copy(car.position).add(new THREE.Vector3(0, 1.5, -2).applyQuaternion(car.quaternion));
    const lookTarget = car.position.clone().add(new THREE.Vector3(0, 1.5, -50).applyQuaternion(car.quaternion));
    this.mirrorCamera.lookAt(lookTarget);

    const width = 350;
    const height = 65;
    const left = (window.innerWidth - width) / 2;
    const bottom = window.innerHeight - (window.innerHeight * 0.105) - height - 15; 

    this.renderer.setViewport(left, bottom, width, height);
    this.renderer.setScissor(left, bottom, width, height);
    this.renderer.setScissorTest(true);
    this.renderer.render(this.scene, this.mirrorCamera);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  }
}
