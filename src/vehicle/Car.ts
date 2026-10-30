import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

export interface RoadAlignmentData {
    x: number;
    y: number;
    tangent: THREE.Vector3;
}

/**
 * Car: The player's vehicle with muscle-car kinetics, smooth road alignment,
 * and cinematic halogen & taillight systems.
 */
export class Car {
  public model: THREE.Group | null = null;
  private scene: THREE.Scene;
  
  // Kinetic State
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public heading: number = 0; 
  public speed: number = 0;

  // Cinematic Lighting & Volumetrics
  private headlights: THREE.SpotLight[] = [];
  private taillights: THREE.PointLight[] = [];
  private volumetricBeams: THREE.Mesh[] = [];
  private groundLightPool?: THREE.Mesh;
  private taillightFlares: THREE.Mesh[] = [];
  private wheelLF: THREE.Object3D | null = null;
  private wheelRF: THREE.Object3D | null = null;

  // Tuning Constants (Calibrated 1973 Malibu Muscle Car)
  private readonly ACCEL = 18;
  private readonly MAX_SPEED = 48;
  private readonly DRAG = 0.28;
  private readonly BRAKE_POWER = 32;
  private readonly MAX_TURN_RATE = 1.4;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Loads the vehicle GLB with fallback geometry.
   */
  public async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    
    try {
        const gltf = await loader.loadAsync(url);
        this.model = gltf.scene;
        
        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const name = child.name.toLowerCase();
            const isInterior = name.includes('cockpit') || 
                               name.includes('caliper') || 
                               name.includes('rotor') || 
                               name.includes('needle') || 
                               name.includes('tach') || 
                               name.includes('speed_') ||
                               name.includes('seat') ||
                               name.includes('cloth');
            if (isInterior) {
              child.visible = false;
              return;
            }
            const isMainBody = name.includes('body_body') || 
                               name.includes('trunk_body') || 
                               name.includes('bumper') ||
                               name.includes('wheel_rim');
            child.castShadow = isMainBody;
            child.receiveShadow = true;

            if (name.includes('wheelf_l') || name.includes('wheel5a_lf') || name.includes('wheellf')) {
              this.wheelLF = child;
            }
            if (name.includes('wheelf_r') || name.includes('wheel5a_rf') || name.includes('wheelrf')) {
              this.wheelRF = child;
            }
            
            if (child.material) {
              const mat = child.material as THREE.MeshStandardMaterial;
              if (mat.color) {
                  const r = mat.color.r;
                  const g = mat.color.g;
                  const b = mat.color.b;
                  mat.color.setRGB(Math.max(0.15, r), Math.max(0.15, g), Math.max(0.15, b));
              }
              mat.roughness = Math.min(mat.roughness ?? 0.4, 0.7);
              mat.metalness = Math.max(mat.metalness ?? 0.4, 0.75);
              mat.envMapIntensity = 1.6;
              mat.needsUpdate = true;
            }
          }
        });

        const box = new THREE.Box3().setFromObject(this.model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 4.5 / (size.z || 1);
        this.model.scale.setScalar(scale);
        
        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scale);
        this.model.position.y = -center.y + (size.y * scale) / 2;

    } catch (error) {
        console.warn('GLB load failed, utilizing high-detail geometric fallback:', error);
        this.createFallbackModel();
    }

    if (this.model) {
        this.scene.add(this.model);
        this.setupLights();
    }
  }

  private createFallbackModel(): void {
      this.model = new THREE.Group();

      // Lower body (chassis)
      const bodyGeo = new THREE.BoxGeometry(2.1, 0.8, 4.6);
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x221a15, metalness: 0.85, roughness: 0.25, envMapIntensity: 1.5 
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      body.receiveShadow = true;
      this.model.add(body);

      // Cabin / Roof
      const cabinGeo = new THREE.BoxGeometry(1.7, 0.65, 2.4);
      const cabinMat = new THREE.MeshStandardMaterial({ 
        color: 0x111116, metalness: 0.9, roughness: 0.15 
      });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.15, -0.2);
      cabin.castShadow = true;
      this.model.add(cabin);

      // Wheels
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
      wheelGeo.rotateZ(Math.PI / 2);
      [
        [-1.05, 0.38, 1.4],
        [1.05, 0.38, 1.4],
        [-1.05, 0.38, -1.4],
        [1.05, 0.38, -1.4]
      ].forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(x, y, z);
        this.model!.add(wheel);
      });
  }

  private setupLights(): void {
    const hlConfig = { color: 0xfff6dc, intensity: 5.5, distance: 95, angle: 0.48, penumbra: 0.55, decay: 1.5 };
    
    // LEFT headlight
    const headlightL = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra, hlConfig.decay);
    headlightL.position.set(-0.7, 0.65, 2.2);
    const targetL = new THREE.Object3D();
    targetL.position.set(-1.0, -0.4, 30); 
    this.model!.add(targetL);
    headlightL.target = targetL;
    this.model!.add(headlightL);
    this.headlights.push(headlightL);

    // RIGHT headlight
    const headlightR = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra, hlConfig.decay);
    headlightR.position.set(0.7, 0.65, 2.2);
    const targetR = new THREE.Object3D();
    targetR.position.set(1.0, -0.4, 30);
    this.model!.add(targetR);
    headlightR.target = targetR;
    this.model!.add(headlightR);
    this.headlights.push(headlightR);

    // 1. Dual Volumetric Headlight Beams (Cutting through rain & nocturnal mist)
    const beamGeo = new THREE.CylinderGeometry(0.12, 3.8, 42, 16, 1, true);
    beamGeo.rotateX(Math.PI / 2);
    beamGeo.translate(0, 0, 21);

    const beamMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0xfff5d8) },
        uIntensity: { value: 0.28 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec2 vUv;
        void main() {
          float radial = sin(vUv.x * 3.14159265);
          float longitudinal = pow(1.0 - vUv.y, 1.5);
          float alpha = radial * longitudinal * uIntensity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    [-0.72, 0.72].forEach((x, idx) => {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, 0.65, 2.2);
      beam.rotation.x = -0.025;
      beam.rotation.y = idx === 0 ? -0.015 : 0.015;
      this.model!.add(beam);
      this.volumetricBeams.push(beam);
    });

    // 2. Projected Ground Light Pool on Asphalt Surface
    const poolGeo = new THREE.PlaneGeometry(10.5, 36);
    poolGeo.rotateX(-Math.PI / 2);
    const poolMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(vec2(p.x * 1.5, p.y));
          float spot = smoothstep(1.0, 0.15, r);
          float fade = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
          float alpha = spot * fade * 0.45;
          gl_FragColor = vec4(1.0, 0.95, 0.82, alpha);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.groundLightPool = new THREE.Mesh(poolGeo, poolMat);
    this.groundLightPool.position.set(0, -0.32, 20);
    this.model!.add(this.groundLightPool);

    // 3. Taillights (subtle rear glow point lights)
    [0.75, -0.75].forEach(x => {
        const light = new THREE.PointLight(0xd41515, 1.0, 10, 2);
        light.position.set(x, 0.55, -2.3);
        this.model!.add(light);
        this.taillights.push(light);
    });

    // 4. Taillight Glowing Lens Flare Plates
    const flareGeo = new THREE.PlaneGeometry(0.55, 0.25);
    const flareMat = new THREE.MeshBasicMaterial({
      color: 0xff1818,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    [-0.78, 0.78].forEach(x => {
      const flare = new THREE.Mesh(flareGeo, flareMat);
      flare.position.set(x, 0.58, -2.36);
      this.model!.add(flare);
      this.taillightFlares.push(flare);
    });
  }

  public update(
    delta: number, 
    input: { steer: number; throttle: number; brake: number }, 
    roadData: RoadAlignmentData
  ): void {
    if (!this.model) return;

    // 1. Kinetic Physics (Acceleration & Drag)
    this.speed += input.throttle * this.ACCEL * delta;
    this.speed -= input.brake * this.BRAKE_POWER * delta;
    this.speed *= (1.0 - Math.min(1.0, this.DRAG * delta));
    this.speed = Math.max(0, Math.min(this.speed, this.MAX_SPEED));

    // 2. Responsive Steering Scale & Interactive Front Wheel Turn
    const speedRatio = Math.min(1.0, this.speed / 14);
    const turnRate = input.steer * this.MAX_TURN_RATE * speedRatio;
    this.heading += turnRate * delta;

    if (this.wheelLF) this.wheelLF.rotation.y = input.steer * 0.45;
    if (this.wheelRF) this.wheelRF.rotation.y = input.steer * 0.45;

    // Natural road curvature tracking when player is not actively steering
    const roadAngle = Math.atan2(roadData.tangent.x, roadData.tangent.z);
    if (Math.abs(input.steer) < 0.05 && this.speed > 3) {
        let angleDiff = roadAngle - this.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.heading += angleDiff * Math.min(1.0, 1.8 * delta);
    }

    // 3. World Position Translation
    this.position.x += Math.sin(this.heading) * this.speed * delta;
    this.position.z += Math.cos(this.heading) * this.speed * delta;

    // 4. Soft Road Shoulder / Curb Boundary
    const lateralDist = this.position.x - roadData.x;
    const maxHalfWidth = 6.8;
    if (Math.abs(lateralDist) > maxHalfWidth) {
        this.position.x = roadData.x + Math.sign(lateralDist) * maxHalfWidth;
        this.heading = THREE.MathUtils.lerp(this.heading, 0, 0.12);
        this.speed *= 0.95; // Curb friction
    }

    // 5. Vertical Smooth Elevation & Pitch Alignment with Suspension Physics
    this.position.y = roadData.y + 0.38;
    this.model.position.copy(this.position);

    // Heading (Yaw)
    this.model.rotation.y = this.heading;

    // Road Hill Slope (Pitch) + Dynamic Suspension Squat/Dive
    const tangent = roadData.tangent;
    const roadPitch = Math.atan2(tangent.y, Math.hypot(tangent.x, tangent.z));
    const dynamicPitch = -roadPitch - (input.throttle * 0.02) + (input.brake * 0.04);
    this.model.rotation.x = THREE.MathUtils.lerp(this.model.rotation.x, dynamicPitch, 0.15);

    // Body Roll (Cornering lean)
    this.model.rotation.z = THREE.MathUtils.lerp(this.model.rotation.z, -input.steer * 0.08, 0.12);

    // 6. Taillight Brightness & Flare on Braking
    const brakeIntensity = input.brake > 0.1 ? 3.5 : 1.0;
    for (let i = 0; i < this.taillights.length; i++) {
        this.taillights[i].intensity = THREE.MathUtils.lerp(this.taillights[i].intensity, brakeIntensity, 0.25);
    }
    const flareOpacity = input.brake > 0.1 ? 1.0 : 0.6;
    const flareScale = input.brake > 0.1 ? 1.35 : 1.0;
    for (let i = 0; i < this.taillightFlares.length; i++) {
      (this.taillightFlares[i].material as THREE.MeshBasicMaterial).opacity = flareOpacity;
      this.taillightFlares[i].scale.set(flareScale, flareScale, 1.0);
    }
  }
}
