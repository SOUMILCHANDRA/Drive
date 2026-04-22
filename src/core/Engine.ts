import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, AfterimagePass } from 'three-stdlib';

/**
 * The core rendering engine.
 * Orchestrates the Three.js scene, camera, renderer, and post-processing pipeline.
 */
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
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; // Calibrate for Sodium Glow
    this.renderer.shadowMap.enabled = true; 
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.getElementById('app')?.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    this.setupLights();
    this.setupPostProcessing();
    this.setupResize();
  }

  /**
   * Configures the environmental lighting (Moonlight, Rim lights, and Ambient Presence).
   */
  private setupLights() {
    const moonlight = new THREE.DirectionalLight(0x050510, 0.1);
    moonlight.position.set(0, 100, -200);
    this.scene.add(moonlight);

    // MOUNTAIN PRESENCE: Deep Purple Ambient (0.05)
    const ambient = new THREE.AmbientLight(0x1a0a2e, 0.05);
    this.scene.add(ambient);

    const rimLight = new THREE.DirectionalLight(0xFF2D95, 0.03);
    rimLight.position.set(100, 10, -100);
    this.scene.add(rimLight);
  }

  /**
   * Initializes the post-processing stack including Bloom, Afterimage, and Film Grain.
   */
  private setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // 1. AFTERIMAGE: Synthwave Trails (0.7 damp)
    const afterimage = new AfterimagePass(0.7);
    this.composer.addPass(afterimage);

    // 2. SELECTIVE BLOOM
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5, 0.4, 0.85
    );
    bloomPass.threshold = 0.1; 
    this.composer.addPass(bloomPass);

    // 3. VIGNETTE: Dark Indigo Tint
    const vignetteShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "offset": { value: 1.0 },
            "darkness": { value: 1.5 },
            "color": { value: new THREE.Color(0x0a0a1f) }
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
            uniform float offset;
            uniform float darkness;
            uniform vec3 color;
            varying vec2 vUv;
            void main() {
                vec4 texel = texture2D(tDiffuse, vUv);
                vec2 uv = (vUv - 0.5) * 2.0;
                float dist = length(uv);
                float vignette = smoothstep(offset, offset - 0.5, dist);
                gl_FragColor = vec4(mix(color, texel.rgb, vignette), texel.a);
            }
        `
    };
    const vignettePass = new ShaderPass(vignetteShader);
    this.composer.addPass(vignettePass);

    // 4. FILM GRAIN
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

  /**
   * Starts the main render loop.
   * @param updateFn Callback for per-frame logic updates
   */
  public render(updateFn: (delta: number) => void) {
    const loop = () => {
      requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      updateFn(delta);
      
      // Update grain noise
      const grainPass = this.composer.passes[this.composer.passes.length - 1] as any;
      if (grainPass && grainPass.uniforms) {
          grainPass.uniforms.time.value += delta;
      }
      
      this.composer.render();
    };
    loop();
  }
}
