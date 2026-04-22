import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass } from 'three-stdlib';

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private clock: THREE.Clock;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0f); // Drive 2011 Near-Black
    this.scene.fog = new THREE.FogExp2(0x0a0a0f, 0.005); 
    
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    document.getElementById('app')?.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.setupPostProcessing();
    this.setupResize();
  }

  private setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // 1. SELECTIVE BLOOM: Halogen Glow
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.2, 0.4, 0.85
    );
    bloomPass.threshold = 0.6;
    this.composer.addPass(bloomPass);

    // 2. FILM GRAIN: 35mm Texture
    const grainShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "amount": { value: 0.03 },
            "time": { value: 0.0 }
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
            uniform float amount;
            uniform float time;
            varying vec2 vUv;
            float random(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
            void main() {
                vec4 color = texture2D(tDiffuse, vUv);
                float noise = random(vUv + time) * amount;
                gl_FragColor = vec4(color.rgb + noise, color.a);
            }
        `
    };
    const grainPass = new ShaderPass(grainShader);
    this.composer.addPass(grainPass);
  }

  private setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public render(updateFn: (delta: number) => void) {
    const loop = () => {
      requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      updateFn(delta);
      
      // Update grain noise
      const grainPass = this.composer.passes[2] as any;
      if (grainPass && grainPass.uniforms) {
          grainPass.uniforms.time.value += delta;
      }
      
      this.composer.render();
    };
    loop();
  }
}
