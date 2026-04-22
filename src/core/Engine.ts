import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/examples/jsm/postprocessing/FilmPass.js';
import { VignetteShader } from 'three/examples/jsm/shaders/VignetteShader.js';
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
    this.scene.fog = new THREE.FogExp2(CONFIG.VISUALS.FOG_COLOR, CONFIG.VISUALS.FOG_DENSITY);
    this.camera = new THREE.PerspectiveCamera(
      CONFIG.VISUALS.CAM_FOV,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = 1.0; 

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
      CONFIG.VISUALS.BLOOM_THRESHOLD
    );

    const filmPass = new FilmPass(CONFIG.VISUALS.FILM_NOISE, 0, 0, false);
    
    const vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms['offset'].value = 0.95;
    vignettePass.uniforms['darkness'].value = 1.6;

    const rgbShiftPass = new ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms['amount'].value = 0.0006;

    // Custom Color Grading Shader (Balanced)
    const colorGradeShader = {
      uniforms: {
        "tDiffuse": { value: null },
        "uShadows": { value: new THREE.Color(0x0a0e1a) },
        "uHighlights": { value: new THREE.Color(0xfff5e0) }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec3 uShadows;
        uniform vec3 uHighlights;
        varying vec2 vUv;
        void main() {
          vec4 color = texture2D(tDiffuse, vUv);
          float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          vec3 shadows = mix(uShadows * 0.3, color.rgb, gray);
          vec3 highlights = mix(color.rgb, uHighlights, gray);
          color.rgb = mix(shadows, highlights, gray * 0.5 + 0.5);
          gl_FragColor = color;
        }
      `
    };
    const gradePass = new ShaderPass(colorGradeShader);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(bloomPass);
    this.composer.addPass(rgbShiftPass);
    this.composer.addPass(filmPass);
    this.composer.addPass(vignettePass);
    this.composer.addPass(gradePass);

    this.setupLights();
    this.setupResize();
    this.scene.background = new THREE.Color(CONFIG.VISUALS.BACKGROUND_COLOR);

    // Default camera position
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);
  }

  private setupLights() {
    // Ambient Visibility
    const ambientLight = new THREE.AmbientLight(CONFIG.LIGHTING.AMBIENT_COLOR, CONFIG.LIGHTING.AMBIENT_INTENSITY);
    this.scene.add(ambientLight);

    // Atmosphere Tint
    const hemiLight = new THREE.HemisphereLight(
      CONFIG.LIGHTING.HEMI_SKY_COLOR,
      CONFIG.LIGHTING.HEMI_GROUND_COLOR,
      0.4
    );
    this.scene.add(hemiLight);

    // Rim/Key Light from behind-above
    const rimLight = new THREE.DirectionalLight(0x1a2a3a, 0.4);
    rimLight.position.set(0, 10, -20);
    this.scene.add(rimLight);
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
