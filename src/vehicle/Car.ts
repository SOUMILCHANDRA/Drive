/**
 * ============================================================================
 * VEHICLE COORDINATE & STEERING CONVENTION
 * ============================================================================
 * - Forward = the direction the car's nose points, in world space (+Z along highway).
 * - Three.js: positive rotation.y = counter-clockwise from above = turn LEFT.
 * - Left input = +steer, Right input = -steer, and
 *   heading += steer * speedFactor * dt.
 * - Model faces +Z:
 *     Forward vector = (sin(heading), 0, cos(heading)).
 *     Velocity uses the SAME vector as the visual orientation:
 *     velocity.x = sin(heading) * speed;
 *     velocity.z = cos(heading) * speed;
 * - GLB Model orientation:
 *     The raw car.glb model originally faced -Z. It is wrapped inside a parent
 *     wrapper Group with child.rotation.y = Math.PI so it points along +Z.
 *     No compensating negative signs are used in the physics engine.
 * - Chase Camera:
 *     Sits behind the car along -forward (Z = -7.2) with camera.up = (0, 1, 0).
 *     Turning left (+steer) swings the car visibly to screen-left.
 * ============================================================================
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';

export interface RoadAlignmentData {
    x: number;
    y: number;
    tangent: THREE.Vector3;
    position?: THREE.Vector3;
}

/**
 * Car: The player's vehicle with muscle-car kinetics, smooth road alignment,
 * dedicated road-mesh ground snapping, and cinematic halogen & taillight systems.
 */
export class Car {
  public model: THREE.Group | null = null;
  private scene: THREE.Scene;
  
  // Kinetic State
  public position: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public velocity: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public heading: number = 0; 
  public speed: number = 0;

  // Ground Snapping & Lane Telemetry
  public groundNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  public currentLateralOffset: number = 0;
  public targetLaneOffset: number = 0;
  public isOnRoad: boolean = true;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private downVector: THREE.Vector3 = new THREE.Vector3(0, -1, 0);
  private rayOrigin: THREE.Vector3 = new THREE.Vector3();
  private debugLogTimer: number = 0;

  // Cinematic Lighting & Volumetrics
  private headlights: THREE.SpotLight[] = [];
  private taillights: THREE.PointLight[] = [];
  private volumetricBeams: THREE.Mesh[] = [];
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
   * Spawns the vehicle in an offset lane with initial heading matching road tangent.
   */
  public spawn(spawnPos: THREE.Vector3, initialHeading: number, initialLaneOffset: number, roadMeshes?: THREE.Object3D[]): void {
      this.position.copy(spawnPos);
      this.heading = initialHeading;
      this.targetLaneOffset = initialLaneOffset;
      this.currentLateralOffset = initialLaneOffset;
      this.speed = 0;
      this.velocity.set(0, 0, 0);

      // Perform initial ground snap immediately so it doesn't float on frame 0
      if (roadMeshes && roadMeshes.length > 0) {
          this.rayOrigin.set(this.position.x, this.position.y + 10.0, this.position.z);
          this.raycaster.set(this.rayOrigin, this.downVector);
          this.raycaster.far = 25.0;
          const hits = this.raycaster.intersectObjects(roadMeshes, false);
          if (hits.length > 0) {
              this.position.y = hits[0].point.y;
              if (hits[0].face) {
                  this.groundNormal.copy(hits[0].face.normal);
                  if (hits[0].object) {
                      this.groundNormal.transformDirection(hits[0].object.matrixWorld);
                  }
              }
          }
      }

      if (this.model) {
          this.model.position.copy(this.position);
          const qSlope = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.groundNormal);
          const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
          this.model.quaternion.copy(qSlope.multiply(qYaw));
      }
  }

  /**
   * Loads the vehicle GLB with fallback geometry.
   */
  public async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    
    try {
        const gltf = await loader.loadAsync(url);
        this.model = new THREE.Group();
        const carModel = gltf.scene;

        // BUG 1 (Step 3): Wrap GLB in parent Group and rotate child by Math.PI so it faces +Z
        carModel.rotation.y = Math.PI;
        
        carModel.traverse((child) => {
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

        // BUG 2 (Step 5): Re-center model inside wrapper Group so pivot sits at bottom center between wheels
        carModel.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(carModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 4.5 / (size.z || 1);
        carModel.scale.setScalar(scale);

        carModel.updateMatrixWorld(true);
        box.setFromObject(carModel);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Center carModel inside wrapper group so pivot (0, 0, 0) is at bottom center between wheels
        carModel.position.set(-center.x, -box.min.y, -center.z);
        this.model.add(carModel);

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
      const carModel = new THREE.Group();

      // Lower body (chassis)
      const bodyGeo = new THREE.BoxGeometry(2.1, 0.8, 4.6);
      const bodyMat = new THREE.MeshStandardMaterial({ 
        color: 0x221a15, metalness: 0.85, roughness: 0.25, envMapIntensity: 1.5 
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      body.receiveShadow = true;
      carModel.add(body);

      // Cabin / Roof
      const cabinGeo = new THREE.BoxGeometry(1.7, 0.65, 2.4);
      const cabinMat = new THREE.MeshStandardMaterial({ 
        color: 0x111116, metalness: 0.9, roughness: 0.15 
      });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(0, 1.15, -0.2);
      cabin.castShadow = true;
      carModel.add(cabin);

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
        carModel.add(wheel);
      });

      this.model.add(carModel);
  }

  private setupLights(): void {
    const hlConfig = { 
      color: 0xfff6dc, 
      intensity: 5.5, 
      distance: 85, 
      angle: 0.5, 
      penumbra: 0.7, 
      decay: 1.4 
    };
    
    // LEFT headlight
    const headlightL = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra, hlConfig.decay);
    headlightL.castShadow = false;
    headlightL.position.set(-0.7, 0.65, 2.2);
    const targetL = new THREE.Object3D();
    targetL.position.set(-0.7, -0.3, 30); 
    this.model!.add(targetL);
    headlightL.target = targetL;
    this.model!.add(headlightL);
    this.headlights.push(headlightL);

    // RIGHT headlight
    const headlightR = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra, hlConfig.decay);
    headlightR.castShadow = false;
    headlightR.position.set(0.7, 0.65, 2.2);
    const targetR = new THREE.Object3D();
    targetR.position.set(0.7, -0.3, 30);
    this.model!.add(targetR);
    headlightR.target = targetR;
    this.model!.add(headlightR);
    this.headlights.push(headlightR);

    // Thin volumetric cone beams: ConeGeometry with 36 radial segments, reaches ~25m forward
    const coneRadius = 2.6;
    const coneHeight = 25.0;
    const beamGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 36, 1, true);
    // Rotate so apex is at origin and expands forward along +Z
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, coneHeight * 0.5);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff2cc,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide
    });

    [-0.7, 0.7].forEach((x, idx) => {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, 0.65, 2.2);
      beam.rotation.x = -0.015;
      beam.rotation.y = idx === 0 ? -0.01 : 0.01;
      this.model!.add(beam);
      this.volumetricBeams.push(beam);
    });

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
    roadData: RoadAlignmentData,
    roadMeshes?: THREE.Object3D[]
  ): void {
    if (!this.model) return;

    // 1. Kinetic Physics (Acceleration & Drag)
    this.speed += input.throttle * this.ACCEL * delta;
    this.speed -= input.brake * this.BRAKE_POWER * delta;
    this.speed *= (1.0 - Math.min(1.0, this.DRAG * delta));
    this.speed = Math.max(0, Math.min(this.speed, this.MAX_SPEED));

    // 2. Responsive Steering Scale & Interactive Front Wheel Turn
    const rotYBefore = this.heading;
    const speedRatio = Math.min(1.0, this.speed / 14);
    const turnRate = input.steer * this.MAX_TURN_RATE * speedRatio;
    this.heading += turnRate * delta;

    // Diagnostic logging for BUG 1 Step 1
    if (Math.abs(input.steer) > 0.05 && (this.debugLogTimer += delta) > 0.5) {
        this.debugLogTimer = 0;
        const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        console.log(`[STEERING CONVENTION] Input: ${input.steer.toFixed(2)}, Heading before: ${rotYBefore.toFixed(3)}, after: ${this.heading.toFixed(3)}, Forward: (${fwd.x.toFixed(3)}, ${fwd.y.toFixed(3)}, ${fwd.z.toFixed(3)}), Model facing: +Z`);
    }

    if (this.wheelLF) this.wheelLF.rotation.y = input.steer * 0.45;
    if (this.wheelRF) this.wheelRF.rotation.y = input.steer * 0.45;

    // Road tangent & lateral geometry
    const roadTangent = roadData.tangent.clone().normalize();
    const roadNormal = new THREE.Vector3(-roadTangent.z, 0, roadTangent.x).normalize();
    const roadAngle = Math.atan2(roadTangent.x, roadTangent.z);

    // Lateral offset from road centerline (signed distance along road normal)
    const refZ = roadData.position ? roadData.position.z : this.position.z;
    const dx = this.position.x - roadData.x;
    const dz = this.position.z - refZ;
    this.currentLateralOffset = dx * roadNormal.x + dz * roadNormal.z;

    // Lane Keeping Assist when player is NOT actively steering (Acceptance Test: Hold W only without drifting)
    if (Math.abs(input.steer) < 0.05 && this.speed > 1.0) {
        // Positive offset = right lane (+X in road normal, world -X).
        // If car is too far right (current > target), steer LEFT (+heading).
        // If car is too far left / near center (current < target), steer RIGHT (-heading).
        const lateralErr = this.currentLateralOffset - this.targetLaneOffset;
        const laneCorrectionAngle = THREE.MathUtils.clamp(lateralErr * 0.12, -0.25, 0.25);
        const targetHeading = roadAngle + laneCorrectionAngle;
        
        let angleDiff = targetHeading - this.heading;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.heading += angleDiff * Math.min(1.0, 4.0 * delta);
    } else {
        // Player steered: remember new lane position
        this.targetLaneOffset = this.currentLateralOffset;
    }

    // 3. World Position Translation
    // Forward vector = (sin(heading), 0, cos(heading))
    this.velocity.set(
        Math.sin(this.heading) * this.speed,
        0,
        Math.cos(this.heading) * this.speed
    );
    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    // 4. Soft Road Shoulder / Curb Boundary
    const maxHalfWidth = 6.8;
    if (Math.abs(this.currentLateralOffset) > maxHalfWidth) {
        const clampedOffset = Math.sign(this.currentLateralOffset) * maxHalfWidth;
        this.position.x = roadData.x + roadNormal.x * clampedOffset;
        this.heading = THREE.MathUtils.lerp(this.heading, roadAngle, 0.12);
        this.speed *= 0.95; // Curb friction
        this.targetLaneOffset = clampedOffset;
    }

    // 5. Ground Snapping via Raycasting against ROAD MESH ONLY
    this.rayOrigin.set(this.position.x, this.position.y + 5.0, this.position.z);
    this.raycaster.set(this.rayOrigin, this.downVector);
    this.raycaster.far = 15.0;

    let targetGroundY = roadData.y;
    let hitNormal = new THREE.Vector3(0, 1, 0);
    let hitRoad = false;

    if (roadMeshes && roadMeshes.length > 0) {
        const hits = this.raycaster.intersectObjects(roadMeshes, false);
        if (hits.length > 0) {
            const hit = hits[0];
            targetGroundY = hit.point.y;
            if (hit.face) {
                hitNormal.copy(hit.face.normal);
                if (hit.object) {
                    hitNormal.transformDirection(hit.object.matrixWorld);
                }
            }
            hitRoad = true;
        }
    }

    this.isOnRoad = hitRoad || (Math.abs(this.currentLateralOffset) < 7.0);

    // Smooth ground snapping (wheelRadiusOffset = 0 since model pivot is at bottom of wheels)
    const wheelRadiusOffset = 0.0;
    this.position.y = THREE.MathUtils.lerp(this.position.y, targetGroundY + wheelRadiusOffset, Math.min(1.0, 18.0 * delta));
    this.model.position.copy(this.position);

    // 6. Up Vector Alignment to Hit Normal (slerp quaternion) + Steering Yaw Control
    this.groundNormal.lerp(hitNormal, Math.min(1.0, 12.0 * delta));
    const qSlope = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.groundNormal);
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    const targetQuat = qSlope.multiply(qYaw);

    // Dynamic pitch (squat/dive) & cornering body roll
    const dynamicPitch = -(input.throttle * 0.02) + (input.brake * 0.04);
    const dynamicRoll = -input.steer * 0.07;
    const qDynamics = new THREE.Quaternion().setFromEuler(new THREE.Euler(dynamicPitch, 0, dynamicRoll, 'YXZ'));
    targetQuat.multiply(qDynamics);

    this.model.quaternion.slerp(targetQuat, Math.min(1.0, 16.0 * delta));

    // 7. Taillight Brightness & Flare on Braking
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
