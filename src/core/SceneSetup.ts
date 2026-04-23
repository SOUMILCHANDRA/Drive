import * as THREE from 'three';

/**
 * SceneSetup manages the core Three.js components: Renderer, Scene, and Camera.
 * Configured for physically correct rendering and cinematic tone mapping.
 */
export class SceneSetup {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  constructor(containerId: string = 'app') {
    this.scene = new THREE.Scene();
    
    // Environment setup
    this.scene.background = new THREE.Color(0x020205);
    this.scene.fog = new THREE.FogExp2(0x020205, 0.008);

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(
      50, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(0, 2, 5);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Physically correct lighting and tone mapping
    // Note: useLegacyLights is deprecated/removed in newer Three.js versions, 
    // but physicallyCorrectLights is often still used or mapped to intensity scaling.
    (this.renderer as any).useLegacyLights = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.6;
    
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const container = document.getElementById(containerId);
    if (container) {
      container.appendChild(this.renderer.domElement);
    }

    this.setupResize();
  }

  private setupResize(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public render(updateFn?: (delta: number) => void): void {
    const clock = new THREE.Clock();
    
    const animate = () => {
      requestAnimationFrame(animate);
      const delta = clock.getDelta();
      
      if (updateFn) updateFn(delta);
      
      this.renderer.render(this.scene, this.camera);
    };
    
    animate();
  }
}
