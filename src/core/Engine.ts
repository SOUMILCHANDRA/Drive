import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import { CONFIG } from '../config';

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private clock: THREE.Clock;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x050505, CONFIG.VISUALS.FOG_DENSITY);
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // Antialiasing is handled by post-processing or skipped for performance
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    const container = document.getElementById('app');
    if (container) {
      container.appendChild(this.renderer.domElement);
    }

    this.clock = new THREE.Clock();

    // Post processing
    const renderScene = new RenderPass(this.scene, this.camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      CONFIG.VISUALS.BLOOM_STRENGTH,
      CONFIG.VISUALS.BLOOM_RADIUS,
      0.1
    );

    const rgbShiftPass = new ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms['amount'].value = 0.0015;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
    this.composer.addPass(rgbShiftPass);

    this.setupLights();
    this.setupResize();

    // Default camera position
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);
  }

  private setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
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
      this.composer.render();
      requestAnimationFrame(loop);
    };
    loop();
  }
}
