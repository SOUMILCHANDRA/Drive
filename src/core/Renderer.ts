import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass } from 'three-stdlib';
import { CinematicCompositeShader } from '../shaders/PostProcessingShaders';
import type { QualityConfig } from './QualitySettings';

/**
 * Renderer: Manages the WebGL context, cinematic post-processing pipeline,
 * and high-efficiency environment reflections.
 */
export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  
  public compositePass!: ShaderPass;
  public bloomPass!: UnrealBloomPass;
  private mirrorCamera: THREE.PerspectiveCamera;

  public postProcessingEnabled: boolean = true;

  constructor(containerId: string, quality: QualityConfig) {
    const container = document.getElementById(containerId);
    if (!container) throw new Error('Container not found');

    this.renderer = new THREE.WebGLRenderer({
      antialias: quality.tier !== 'LOW',
      powerPreference: 'high-performance',
      stencil: false,
      depth: true
    });
    
    const maxRatio = quality.tier === 'HIGH' ? Math.min(window.devicePixelRatio, 1.5) : 1;
    this.renderer.setPixelRatio(maxRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0; 
    
    this.renderer.shadowMap.enabled = quality.shadowSize > 0;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.autoClear = false;
    this.renderer.info.autoReset = false;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02040c);
    this.scene.fog = new THREE.FogExp2(0x0a1024, 0.00045);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.3, 3000);
    this.mirrorCamera = new THREE.PerspectiveCamera(45, 350 / 65, 0.2, 1000);

    // Setup Post-Processing Stack (Reduced from 6 passes to 3 passes)
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.0,
      0.6,
      0.85
    );
    this.bloomPass.enabled = quality.bloom;
    this.composer.addPass(this.bloomPass);

    // Unified Composite Pass (Radial Aberration + Mono Grain + Vignette + Single ACES/sRGB Output)
    this.compositePass = new ShaderPass(CinematicCompositeShader);
    this.compositePass.uniforms.uGrainIntensity.value = 0.03;
    this.compositePass.uniforms.uAberrationIntensity.value = 0.0015;
    this.compositePass.uniforms.uExposure.value = this.renderer.toneMappingExposure;
    this.composer.addPass(this.compositePass);

    this.setupNocturnalEnvironment();
    this.setupRoadReflectionCamera();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  // Low-resolution time-sliced CubeCamera for dynamic wet road puddle reflections (~10Hz full cubemap cycle)
  private cubeRenderTarget!: THREE.WebGLCubeRenderTarget;
  private cubeCamera!: THREE.CubeCamera;
  private cubeFaceIndex: number = 0;

  private setupRoadReflectionCamera(): void {
    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(64, {
      generateMipmaps: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter
    });
    this.cubeCamera = new THREE.CubeCamera(0.5, 250, this.cubeRenderTarget);
    // Layer 1 isolates reflection objects (sky, skyline, neon) to achieve 60+ FPS and < 150 draw calls
    this.cubeCamera.layers.set(1);
    for (const child of this.cubeCamera.children) {
      child.layers.set(1);
    }
    this.scene.add(this.cubeCamera);
  }

  public getRoadEnvMap(): THREE.Texture {
    return this.cubeRenderTarget.texture;
  }

  public updateRoadReflection(carPos: THREE.Vector3, roadMeshes: THREE.Object3D[], _delta: number, carModel?: THREE.Object3D | null): void {
    this.cubeCamera.position.set(carPos.x, carPos.y + 0.6, carPos.z + 8.0);
    if (this.cubeCamera.parent === null) this.cubeCamera.updateMatrixWorld();

    const cameras = this.cubeCamera.children as THREE.PerspectiveCamera[];
    if (!cameras || cameras.length < 6) return;

    const face = this.cubeFaceIndex;
    this.cubeFaceIndex = (this.cubeFaceIndex + 1) % 6;

    // Temporarily hide the road surface and car so it doesn't self-reflect
    for (let i = 0; i < roadMeshes.length; i++) roadMeshes[i].visible = false;
    if (carModel) carModel.visible = false;

    const currentRenderTarget = this.renderer.getRenderTarget();
    const currentActiveCubeFace = this.renderer.getActiveCubeFace();
    const currentActiveMipmapLevel = this.renderer.getActiveMipmapLevel();
    const prevShadow = this.renderer.shadowMap.enabled;

    this.renderer.shadowMap.enabled = false;
    this.renderer.setRenderTarget(this.cubeRenderTarget, face, 0);
    this.renderer.render(this.scene, cameras[face]);
    this.renderer.shadowMap.enabled = prevShadow;

    this.renderer.setRenderTarget(currentRenderTarget, currentActiveCubeFace, currentActiveMipmapLevel);

    for (let i = 0; i < roadMeshes.length; i++) roadMeshes[i].visible = true;
    if (carModel) carModel.visible = true;

    if (face === 5) {
      this.cubeRenderTarget.texture.needsPMREMUpdate = true;
    }
  }

  /**
   * Generates a smooth nocturnal environment map once at startup.
   * Gives realistic wet asphalt sheen and car reflections with 0 runtime GPU overhead.
   */
  private setupNocturnalEnvironment(): void {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x0a0502);

    // Ambient night sky gradient
    const hemi = new THREE.HemisphereLight(0x20150a, 0x050302, 3.0);
    envScene.add(hemi);

    // Amber horizon glow light
    const horizonGlow = new THREE.DirectionalLight(0xff7700, 2.0);
    horizonGlow.position.set(0, 10, 50);
    envScene.add(horizonGlow);

    const envRt = pmremGenerator.fromScene(envScene, 0.04);
    this.scene.environment = envRt.texture;
    pmremGenerator.dispose();
  }

  public updateRoadMirror(_carPos: THREE.Vector3): void {
    // Legacy no-op kept for API compatibility.
    // Reflections are now efficiently rendered via the environment map!
  }

  public updateQuality(config: QualityConfig): void {
    this.renderer.shadowMap.enabled = config.shadowSize > 0;
    this.bloomPass.enabled = config.bloom;
    this.postProcessingEnabled = config.postProcessing;

    const maxRatio = config.tier === 'HIGH' ? Math.min(window.devicePixelRatio, 1.5) : 1;
    this.renderer.setPixelRatio(maxRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  public toggleShadows(): boolean {
    this.renderer.shadowMap.enabled = !this.renderer.shadowMap.enabled;
    return this.renderer.shadowMap.enabled;
  }

  public setGrainEnabled(enabled: boolean): void {
    if (this.compositePass) {
      this.compositePass.uniforms.uGrainEnabled.value = enabled ? 1.0 : 0.0;
    }
  }

  public setAberrationEnabled(enabled: boolean): void {
    if (this.compositePass) {
      this.compositePass.uniforms.uAberrationEnabled.value = enabled ? 1.0 : 0.0;
    }
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
    this.bloomPass.setSize(window.innerWidth, window.innerHeight);
  }

  public beginFrame(): void {
    this.renderer.info.reset();
  }

  public render(delta: number, steer: number = 0): void {
    this.renderer.clear();
    
    if (this.compositePass) {
      this.compositePass.uniforms.uTime.value += delta;
      this.compositePass.uniforms.uExposure.value = this.renderer.toneMappingExposure;
      const targetAberration = 0.0012 + Math.abs(steer) * 0.0005;
      this.compositePass.uniforms.uAberrationIntensity.value = THREE.MathUtils.lerp(
        this.compositePass.uniforms.uAberrationIntensity.value,
        targetAberration,
        0.1
      );
    }

    if (this.postProcessingEnabled) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public renderMirror(car: THREE.Group): void {
    if (!car) return;
    this.mirrorCamera.position.copy(car.position).add(new THREE.Vector3(0, 1.4, -2).applyQuaternion(car.quaternion));
    const lookTarget = car.position.clone().add(new THREE.Vector3(0, 1.4, -50).applyQuaternion(car.quaternion));
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
