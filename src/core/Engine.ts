import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { CONFIG } from '../config';
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
    this.scene.fog = new THREE.FogExp2(0x050810, 0.006);
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = CONFIG.VISUALS.TONE_EXPOSURE;

    const container = document.getElementById('app');
    if (container) container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.4, 0.7);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
    this.composer.addPass(new FilmPass(0.1, false));
    
    const vignette = new ShaderPass(VignetteShader);
    vignette.uniforms['offset'].value = 0.95;
    vignette.uniforms['darkness'].value = 1.3;
    this.composer.addPass(vignette);

    this.setupLights();
    this.setupResize();
    this.scene.background = new THREE.Color(0x03050a);
  }

  private setupLights() {
    this.scene.add(new THREE.AmbientLight(CONFIG.LIGHTING.AMBIENT_COLOR, CONFIG.LIGHTING.AMBIENT_INTENSITY * 0.05));
    this.scene.add(new THREE.HemisphereLight(CONFIG.LIGHTING.HEMI_SKY_COLOR, CONFIG.LIGHTING.HEMI_GROUND_COLOR, CONFIG.LIGHTING.HEMI_INTENSITY * 0.05));
    
    const rim = new THREE.DirectionalLight(0x445577, 0.5);
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
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    loop();
  }
}
