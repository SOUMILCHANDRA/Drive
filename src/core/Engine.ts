import * as THREE from 'three';

export class Engine {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x00ff00); // DEBUG GREEN
    
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 2000);
    // STEP 3: Fix Camera
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // STEP 5: Fix tone mapping
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.8;
    
    // Parent to #app instead of body
    document.getElementById('app')?.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();
    
    // STEP 2: Add Debug Cube
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    this.scene.add(cube);

    this.setupLights();
    this.setupResize();
  }

  private setupLights() {
    // STEP 4: Add REAL light
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(10, 10, 10);
    this.scene.add(light);
    
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambient);
  }

  private setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  public render(updateFn: (delta: number) => void) {
    const loop = () => {
      requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      updateFn(delta);
      // STEP 1: Bypass EVERYTHING
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}
