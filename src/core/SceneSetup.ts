import * as THREE from 'three';

/**
 * SceneSetup: Strictly follows physically correct rendering specifications.
 */
export class SceneSetup {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;

  constructor(containerId: string = 'app') {
    this.scene = new THREE.Scene();
    
    // Scene Atmosphere
    // High-Quality Midnight Sky
    this.scene.background = new THREE.Color(0x020205);
    this.scene.fog = new THREE.FogExp2(0x020205, 0.008); 


    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 2, -6);

    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      powerPreference: "high-performance"
    });
    
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // MANDATORY RENDERER CONFIG
    (this.renderer as any).physicallyCorrectLights = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0; // Darkened for cinematic contrast
    
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.getElementById(containerId)?.appendChild(this.renderer.domElement);
    this.setupResize();
  }

  private setupResize(): void {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public render(updateFn: (delta: number) => void): void {
    const clock = new THREE.Clock();
    const animate = () => {
      requestAnimationFrame(animate);
      updateFn(clock.getDelta());
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }
}
