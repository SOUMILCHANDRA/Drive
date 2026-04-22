import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock: THREE.Clock;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x03050a);
    // FIX: fog density 0.006 — previous 0.018 blacked out at ~20m
    this.scene.fog = new THREE.FogExp2(0x050810, 0.006);

    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // FIX: exposure 1.8 — the single biggest visibility fix
    this.renderer.toneMappingExposure = 1.8;

    const container = document.getElementById('app');
    if (container) container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    // Post-processing
    const renderScene = new RenderPass(this.scene, this.camera);
    // FIX: bloom threshold 0.75 so only headlight cores bloom, not the whole scene
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.35,  // strength — subtle
      0.4,   // radius
      0.75   // threshold — only near-white pixels bloom
    );

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
    // Film grain — adds enormous cinematic realism
    this.composer.addPass(new FilmPass(0.2, false));

    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms['offset'].value = 0.9;
    vignette.uniforms['darkness'].value = 1.2;
    this.composer.addPass(vignette);

    this.setupLights();
    this.setupResize();
  }

  private setupLights() {
    // FIX: removed the *0.05 multiplier that was making lights effectively zero

    // Ambient — dark blue-grey, enough to see terrain silhouettes
    this.scene.add(new THREE.AmbientLight(0x1a2540, 0.9));

    // Hemisphere — sky MUST be dark blue, NOT warm/red
    // FIX: hardcoded safe colors here, don't trust config values for sky color
    const hemi = new THREE.HemisphereLight(
      0x1a2a4a,  // sky: dark blue — this was likely 0xff0000 in config causing red sky
      0x0a0a0f,  // ground: near black
      0.6
    );
    this.scene.add(hemi);

    // Rim light — separates car from background like a cinema backlight
    const rim = new THREE.DirectionalLight(0x334466, 0.4);
    rim.position.set(0, 10, -20);
    this.scene.add(rim);
  }

  private setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public render(callback: (delta: number) => void) {
    const loop = () => {
      const delta = this.clock.getDelta();
      callback(delta);
      // FIX: use composer.render() NOT renderer.render()
      // Your original code called renderer.render() which bypassed all post-processing
      this.composer.render();
      requestAnimationFrame(loop);
    };
    loop();
  }
}
