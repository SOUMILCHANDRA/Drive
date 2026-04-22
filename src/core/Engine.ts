import * as THREE from 'three';
import { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass } from 'three-stdlib';

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
    this.scene.background = new THREE.Color(0x050508);
    // FINAL LOCK: Slow Roads Atmospheric Scale
    this.scene.fog = new THREE.FogExp2(0x050508, 0.015); 
    
    this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; 
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

    // MOUNTAIN PRESENCE: Blue Hour Fill (0.05)
    const ambient = new THREE.AmbientLight(0x0d0d2b, 0.05);
    this.scene.add(ambient);

    // CINEMATIC DEPTH: Final Aesthetic Lock (Indigo Rim)
    const hemi = new THREE.HemisphereLight(0x0a0a2e, 0x000000, 0.2);
    this.scene.add(hemi);

    // SILHOUETTE LIFT: High-angle Indigo light for car definition
    const lift = new THREE.DirectionalLight(0x0a0a2e, 0.1);
    lift.position.set(0, 100, 0);
    this.scene.add(lift);

    // THE "DRIVER" RIM LIGHT: Pink silhouette definition
    const rimLight = new THREE.DirectionalLight(0xFF2D95, 0.05);
    rimLight.position.set(0, 2, -10);
    this.scene.add(rimLight);
  }

  /**
   * Initializes the post-processing stack including Bloom, Afterimage, and Film Grain.
   */
  private setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // 1. SELECTIVE BLOOM: High threshold for Halogen/Tail-light bleed
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.2, 0.5, 0.8 // Calibrated for Fog bleed
    );
    bloomPass.threshold = 0.8; 
    this.composer.addPass(bloomPass);

    // 2. ORANGE & TEAL COLOR GRADE
    const colorGradeShader = {
        uniforms: {
            "tDiffuse": { value: null },
            "teal": { value: new THREE.Color(0x00ffff) },
            "orange": { value: new THREE.Color(0xff8800) },
            "mixAmount": { value: 0.15 }
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
            uniform vec3 teal;
            uniform vec3 orange;
            uniform float mixAmount;
            varying vec2 vUv;
            void main() {
                vec4 texel = texture2D(tDiffuse, vUv);
                float lum = dot(texel.rgb, vec3(0.299, 0.587, 0.114));
                vec3 grade = mix(teal * lum, orange * lum, lum);
                gl_FragColor = vec4(mix(texel.rgb, grade, mixAmount), texel.a);
            }
        `
    };
    this.composer.addPass(new ShaderPass(colorGradeShader));

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
   * Orchestrates the cinematic ignition sequence.
   * Ramps exposure and FOV to simulate a camera lens focusing and headlights powering on.
   */
  public ignite() {
    const TARGET_EXPOSURE = 1.2;
    const IGNITION_DURATION = 2000; // 2s ramp
    const FOV_SNAP_AMOUNT = 3;

    this.renderer.toneMappingExposure = 0;
    const start = performance.now();

    const animateIgnition = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / IGNITION_DURATION, 1);
      
      // Easing: Quad Out
      const ease = 1 - (1 - progress) * (1 - progress);
      
      this.renderer.toneMappingExposure = ease * TARGET_EXPOSURE;
      
      // Subtle lens snap: Start slightly zoomed and pull back
      this.camera.fov = (45 + FOV_SNAP_AMOUNT) - (ease * FOV_SNAP_AMOUNT); 
      this.camera.updateProjectionMatrix();

      if (progress < 1) {
        requestAnimationFrame(animateIgnition);
      }
    };

    requestAnimationFrame(animateIgnition);
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
