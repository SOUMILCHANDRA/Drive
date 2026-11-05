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
import { RoadLanes } from '../world/RoadLanes';

export interface RoadAlignmentData {
    x: number;
    y: number;
    tangent: THREE.Vector3;
    position?: THREE.Vector3;
}

export interface WheelAssembly {
    name: string;
    isFront: boolean;
    radius: number;
    wheelAnchor: THREE.Object3D;
    steerPivot: THREE.Object3D;
    spinPivot: THREE.Object3D;
    wheelMesh: THREE.Mesh;
}

/**
 * Unified HANDLING Configuration (Slow Roads Feel)
 * Calm, weighty, forgiving cruise with bicycle dynamics, smooth inputs, and lane assist.
 */
export const HANDLING = {
  // Speed & Cruise targets (slowroads.io feel)
  cruiseSpeedMin: 70, // km/h
  cruiseSpeedMax: 110, // km/h
  softCapKmh: 160, // km/h
  dragThresholdKmh: 120, // km/h (strong drag beyond ~120)
  baseDrag: 0.08, // gentle coasting drag
  highSpeedDrag: 0.70, // strong drag > 120 km/h
  engineBraking: 0.28, // gentle engine braking when throttle is released
  brakeForce: 26.0, // m/s^2 braking power

  // Throttle (ramp acceleration over ~1 s, no instant torque)
  throttleRampTime: 1.0, // s
  baseAccel: 14.0, // m/s^2

  // Steering (smoothed rate ~2.5/s, return slowly)
  steerInputRate: 2.5, // input smoothing rate ~2.5/s
  steerReturnRate: 1.8, // returns to center slowly
  maxSteerLowSpeed: 0.45, // rad
  maxSteerHighSpeed: 0.08, // rad scaled down with speed

  // Lateral dynamics: Bicycle model
  wheelbase: 2.85, // m
  understeerFactor: 0.30, // light understeer at high speed
  yawLowPassTau: 0.18, // s low-pass filter

  // Body dynamics
  bodyRollMaxDeg: 1.5, // +/- 1.5 deg small body roll
  pitchAccelDeg: 0.65, // deg pitch on accel
  pitchBrakeDeg: 1.25, // deg pitch on brake

  // Lane assist (soft pull toward lane center, toggle with L)
  laneAssistEnabled: true,
  laneAssistStrength: 0.15, // soft pull strength

  // Collisions (scrub speed by ~40%, nudge car, no hard stops)
  collisionSpeedScrub: 0.40, // 40% speed scrub
  collisionNudgeLateral: 1.2, // m
  collisionNudgeYaw: 0.06 // rad
};

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

  // Handling State Variables (Slow Roads Dynamics)
  public smoothedThrottle: number = 0;
  public smoothedSteer: number = 0;
  public filteredYawRate: number = 0;
  public rollAngle: number = 0;
  public pitchAngle: number = 0;

  // Ground Snapping & Lane Telemetry
  public groundNormal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  public currentLateralOffset: number = 0;
  public targetLaneOffset: number = 0;
  public isOnRoad: boolean = true;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private downVector: THREE.Vector3 = new THREE.Vector3(0, -1, 0);
  private rayOrigin: THREE.Vector3 = new THREE.Vector3();

  // Cinematic Lighting & Volumetrics
  private headlights: THREE.SpotLight[] = [];
  private volumetricBeams: THREE.Mesh[] = [];
  private taillightMaterials: THREE.MeshStandardMaterial[] = [];

  // Wheel Hierarchy Assembly (Bug 1 Fix: 4-tier anchor -> steer -> spin -> mesh)
  public wheels: WheelAssembly[] = [];

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
        this.model.name = 'carRoot';
        const carModel = gltf.scene;
        carModel.name = 'carModel';

        // Raw GLB model faces +Z (hood points down highway (+Z), trunk faces chase camera (-Z))
        carModel.rotation.y = 0;
        
        // Materials per Step 2 specifications
        const bodyMat = new THREE.MeshPhysicalMaterial({
            name: 'CarBody_DeepRed',
            color: 0x7a0c14, // deep red
            metalness: 0.6,
            roughness: 0.3,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            envMapIntensity: 2.2
        });

        const glassMat = new THREE.MeshPhysicalMaterial({
            name: 'CarGlass_DarkReflective',
            color: 0x050711,
            metalness: 0.9,
            roughness: 0.04,
            transparent: true,
            opacity: 0.88,
            clearcoat: 1.0,
            clearcoatRoughness: 0.04,
            envMapIntensity: 3.0
        });

        const chromeMat = new THREE.MeshStandardMaterial({
            name: 'CarChrome',
            color: 0xd8dde8,
            metalness: 0.95,
            roughness: 0.15,
            envMapIntensity: 2.0
        });

        const undercarriageMat = new THREE.MeshStandardMaterial({
            name: 'CarUndercarriage',
            color: 0x141418,
            metalness: 0.2,
            roughness: 0.9
        });

        const rubberMat = new THREE.MeshStandardMaterial({
            name: 'CarRubber',
            color: 0x18181a,
            metalness: 0.05,
            roughness: 0.85
        });

        const headlightLensMat = new THREE.MeshStandardMaterial({
            name: 'CarHeadlight_Emissive',
            color: 0xfffaed,
            emissive: 0xfffaed,
            emissiveIntensity: 3.5,
            metalness: 0.2,
            roughness: 0.1
        });

        const taillightLensMat = new THREE.MeshStandardMaterial({
            name: 'CarTaillight_Emissive',
            color: 0xff1010,
            emissive: 0xff1010,
            emissiveIntensity: 1.5,
            metalness: 0.1,
            roughness: 0.2
        });
        this.taillightMaterials.push(taillightLensMat);

        const wheelMeshes: THREE.Mesh[] = [];

        // Traverse and assign materials without merging or instancing
        carModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const name = child.name.toLowerCase();
            const mat = child.material;
            const matName = (mat && !Array.isArray(mat) ? (mat as any).name : '').toLowerCase();

            // Collect the 4 wheels
            if (name.includes('wheel5a') || name.includes('z:wheel5a')) {
              wheelMeshes.push(child);
              return;
            }

            // Hide old duplicate wheel rim copies
            if (name.includes('lod0_wheel') || name.includes('lod0che_chevelle_70_lod0_wheel') || name.includes('wheel_inner') || name.includes('wheel_outer') || name.includes('wheel_black') || name.includes('wheel_rim')) {
              child.visible = false;
              return;
            }

            // Hide interior cockpit, engine brackets, and hidden chassis sub-frames
            const isInterior = name.includes('cockpit') || 
                               name.includes('caliper') || 
                               name.includes('rotor') ||
                               name.includes('seat') ||
                               name.includes('frame_') ||
                               name.includes('_black_') ||
                               name.includes('matte_colors') ||
                               name.includes('plastic2') ||
                               name.includes('rubber_trim');
            if (isInterior) {
              child.visible = false;
              return;
            }

            // Restore all exterior details, glass, lights, and undercarriage
            child.visible = true;
            const isMainShadowCaster = name.includes('body_body') || name.includes('trunk_body') || name.includes('bumper') || name.includes('undercarriage');
            child.castShadow = isMainShadowCaster;
            child.receiveShadow = true;

            if (name.includes('undercarriage') || name.includes('under_')) {
              child.material = undercarriageMat;
            } else if (name.includes('glass') || name.includes('window') || matName.includes('window') || matName.includes('glass')) {
              if (name.includes('rtl') || name.includes('ltl') || name.includes('red')) {
                child.material = taillightLensMat;
              } else if (name.includes('rhl') || name.includes('lhl') || name.includes('head')) {
                child.material = headlightLensMat;
              } else {
                child.material = glassMat;
              }
            } else if (name.includes('body_body') || name.includes('trunk_body') || name.includes('hooda_body') || matName.includes('carpaint')) {
              child.material = bodyMat;
            } else if (name.includes('head_light') || name.includes('light_0')) {
              child.material = headlightLensMat;
            } else if (name.includes('reflector') || name.includes('tail')) {
              child.material = taillightLensMat;
            } else if (name.includes('chrome') || matName.includes('ext_metal') || name.includes('bumper')) {
              child.material = chromeMat;
            } else if (name.includes('rubber') || name.includes('weatherstrip')) {
              child.material = rubberMat;
            }
          }
        });

        // Correct car scale so the length is ~4.8 m
        carModel.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(carModel);
        const size = new THREE.Vector3();
        box.getSize(size);
        const targetLength = 4.8;
        const scale = targetLength / (size.z || 1);
        carModel.scale.setScalar(scale);

        // Center car model so bottom sits on road (y = 0) and center is at (0, 0, 0)
        carModel.updateMatrixWorld(true);
        const scaledBox = new THREE.Box3().setFromObject(carModel);
        const center = new THREE.Vector3();
        scaledBox.getCenter(center);
        carModel.position.set(-center.x, -scaledBox.min.y, -center.z);
        this.model.add(carModel);

        // Build wheel hierarchy: carRoot > wheelAnchor > steerPivot (front only) > spinPivot > wheelMesh
        this.model.updateMatrixWorld(true);
        this.wheels = [];

        for (const origMesh of wheelMeshes) {
          origMesh.updateMatrixWorld(true);
          const wBox = new THREE.Box3().setFromObject(origMesh);
          const axlePos = new THREE.Vector3();
          wBox.getCenter(axlePos);
          const wSize = new THREE.Vector3();
          wBox.getSize(wSize);
          const radius = wSize.y * 0.5;

          // Re-center geometry around (0, 0, 0)
          origMesh.geometry.center();
          origMesh.position.set(0, 0, 0);
          origMesh.rotation.set(0, 0, 0);
          origMesh.scale.set(1, 1, 1);
          origMesh.castShadow = true;
          origMesh.receiveShadow = true;

          // Detach from carModel
          if (origMesh.parent) {
            origMesh.parent.remove(origMesh);
          }

          const spinPivot = new THREE.Object3D();
          spinPivot.name = origMesh.name + '_spinPivot';
          spinPivot.add(origMesh);

          const isFront = axlePos.z > 0;
          const steerPivot = new THREE.Object3D();
          steerPivot.name = origMesh.name + '_steerPivot';
          steerPivot.add(spinPivot);

          const wheelAnchor = new THREE.Object3D();
          wheelAnchor.name = origMesh.name + '_wheelAnchor';
          wheelAnchor.position.copy(axlePos);
          wheelAnchor.add(steerPivot);

          this.model.add(wheelAnchor);

          this.wheels.push({
            name: origMesh.name,
            isFront,
            radius: Math.max(0.1, radius),
            wheelAnchor,
            steerPivot,
            spinPivot,
            wheelMesh: origMesh
          });
        }

        this.printSceneGraph();

    } catch (error) {
        console.warn('GLB load failed, utilizing high-detail geometric fallback:', error);
        this.createFallbackModel();
    }

    if (this.model) {
        this.scene.add(this.model);
        this.setupLights();
    }
  }

  public printSceneGraph(): void {
    if (!this.model) return;
    console.log('=== CAR SCENE GRAPH TREE ===');
    const printTree = (obj: THREE.Object3D, indent: string) => {
      let matInfo = 'none';
      if ((obj as THREE.Mesh).material) {
        const m = (obj as THREE.Mesh).material;
        matInfo = Array.isArray(m) ? m.map(x => x.name || x.type).join(', ') : (m.name || m.type);
      }
      const s = obj.scale;
      const scaleStr = `(${s.x.toFixed(2)}, ${s.y.toFixed(2)}, ${s.z.toFixed(2)})`;
      console.log(`${indent}├─ [${obj.type}] "${obj.name || 'unnamed'}" (visible: ${obj.visible}, scale: ${scaleStr}, mat: ${matInfo})`);
      for (const child of obj.children) {
        printTree(child, indent + '│  ');
      }
    };
    printTree(this.model, '');
    console.log('============================');
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
      this.model.add(carModel);

      // Wheels 4-tier assembly
      this.wheels = [];
      const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 24);
      wheelGeo.rotateZ(Math.PI / 2);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
      [
        { name: 'fallback_FL', pos: [-1.05, 0.38, 1.4], isFront: true },
        { name: 'fallback_FR', pos: [1.05, 0.38, 1.4], isFront: true },
        { name: 'fallback_RL', pos: [-1.05, 0.38, -1.4], isFront: false },
        { name: 'fallback_RR', pos: [1.05, 0.38, -1.4], isFront: false }
      ].forEach(({ name, pos, isFront }) => {
        const geom = wheelGeo.clone();
        geom.center();
        const wheelMesh = new THREE.Mesh(geom, wheelMat);
        wheelMesh.castShadow = true;
        wheelMesh.receiveShadow = true;
        wheelMesh.matrixAutoUpdate = true;

        const spinPivot = new THREE.Object3D();
        spinPivot.matrixAutoUpdate = true;
        spinPivot.add(wheelMesh);

        const steerPivot = new THREE.Object3D();
        steerPivot.matrixAutoUpdate = true;
        steerPivot.add(spinPivot);

        const wheelAnchor = new THREE.Object3D();
        wheelAnchor.position.set(pos[0], pos[1], pos[2]);
        wheelAnchor.matrixAutoUpdate = true;
        wheelAnchor.add(steerPivot);

        this.model!.add(wheelAnchor);
        this.wheels.push({
          name,
          isFront,
          radius: 0.38,
          wheelAnchor,
          steerPivot,
          spinPivot,
          wheelMesh
        });
      });
  }

  private setupLights(): void {
    const hlConfig = { 
      color: 0xfffaed, 
      intensity: 5.0, 
      distance: 60, 
      angle: 0.45, 
      penumbra: 0.8, 
      decay: 1.2 
    };
    
    // LEFT headlight
    const headlightL = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra, hlConfig.decay);
    headlightL.castShadow = false;
    headlightL.position.set(-0.75, 0.65, 2.3);
    const targetL = new THREE.Object3D();
    targetL.position.set(-0.75, 0.1, 35); 
    this.model!.add(targetL);
    headlightL.target = targetL;
    this.model!.add(headlightL);
    this.headlights.push(headlightL);

    // RIGHT headlight
    const headlightR = new THREE.SpotLight(hlConfig.color, hlConfig.intensity, hlConfig.distance, hlConfig.angle, hlConfig.penumbra, hlConfig.decay);
    headlightR.castShadow = false;
    headlightR.position.set(0.75, 0.65, 2.3);
    const targetR = new THREE.Object3D();
    targetR.position.set(0.75, 0.1, 35);
    this.model!.add(targetR);
    headlightR.target = targetR;
    this.model!.add(headlightR);
    this.headlights.push(headlightR);

    // Faint additive volumetric cone beams
    const coneRadius = hlConfig.distance * Math.tan(hlConfig.angle) * 0.45;
    const coneHeight = 35.0;
    const beamGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 24, 1, true);
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, coneHeight * 0.5);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfffaed,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    [-0.75, 0.75].forEach((x, idx) => {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(x, 0.65, 2.32);
      beam.rotation.x = 0.02;
      beam.rotation.y = idx === 0 ? -0.01 : 0.01;
      this.model!.add(beam);
      this.volumetricBeams.push(beam);
    });
  }

  public update(
    delta: number, 
    input: { steer: number; throttle: number; brake: number }, 
    roadData: RoadAlignmentData,
    roadMeshes?: THREE.Object3D[]
  ): void {
    if (!this.model) return;

    // 1. Throttle Ramping (ramp over ~1s, no instant torque) & Speed Kinetics
    const throttleRate = 1.0 / Math.max(0.1, HANDLING.throttleRampTime);
    if (input.throttle > this.smoothedThrottle) {
        this.smoothedThrottle = Math.min(input.throttle, this.smoothedThrottle + throttleRate * delta);
    } else {
        this.smoothedThrottle = Math.max(0, this.smoothedThrottle - (throttleRate * 2.5) * delta);
    }

    const speedKmh = this.speed * 3.6;
    const speedRatio160 = Math.min(1.0, speedKmh / HANDLING.softCapKmh);

    // Speed-dependent torque curve (strong low-mid cruise torque, smooth ease toward high speed)
    const torqueCurve = Math.max(0.12, 1.0 - Math.pow(speedRatio160, 1.25));
    const accel = this.smoothedThrottle * HANDLING.baseAccel * torqueCurve;

    // Coasting drag, engine braking, and strong aero drag beyond 120 km/h
    let drag = HANDLING.baseDrag;
    if (this.smoothedThrottle < 0.05 && input.brake < 0.05) {
        drag += HANDLING.engineBraking;
    }
    if (speedKmh > HANDLING.dragThresholdKmh) {
        const over = (speedKmh - HANDLING.dragThresholdKmh) / (HANDLING.softCapKmh - HANDLING.dragThresholdKmh);
        drag += HANDLING.highSpeedDrag * (over * over);
    }

    this.speed += (accel - drag * this.speed - input.brake * HANDLING.brakeForce) * delta;
    this.speed = Math.max(0, this.speed);
    // Soft cap 160 km/h
    if (this.speed * 3.6 > HANDLING.softCapKmh) {
        this.speed = THREE.MathUtils.lerp(this.speed, HANDLING.softCapKmh / 3.6, Math.min(1.0, 4.0 * delta));
    }

    // 2. Smoothed Steering & Speed-Scaled Max Steering
    // Max steer angle scales down with speed: lerp(0.45, 0.08, speed/160)
    const maxSteer = THREE.MathUtils.lerp(HANDLING.maxSteerLowSpeed, HANDLING.maxSteerHighSpeed, speedRatio160);
    const targetSteer = input.steer * maxSteer;

    const isCentering = Math.abs(targetSteer) < Math.abs(this.smoothedSteer);
    const steerRate = isCentering ? HANDLING.steerReturnRate : HANDLING.steerInputRate;
    if (this.smoothedSteer < targetSteer) {
        this.smoothedSteer = Math.min(targetSteer, this.smoothedSteer + steerRate * delta);
    } else if (this.smoothedSteer > targetSteer) {
        this.smoothedSteer = Math.max(targetSteer, this.smoothedSteer - steerRate * delta);
    }

    // 3. Lateral Dynamics: Bicycle Model
    // yawRate = speed * tan(steer) / wheelbase with low-pass filter & light high-speed understeer
    const understeer = 1.0 + HANDLING.understeerFactor * speedRatio160;
    const effectiveSteer = this.smoothedSteer / understeer;
    const targetYawRate = (this.speed * Math.tan(effectiveSteer)) / HANDLING.wheelbase;

    const alphaYaw = Math.min(1.0, delta / Math.max(0.01, HANDLING.yawLowPassTau));
    this.filteredYawRate += (targetYawRate - this.filteredYawRate) * alphaYaw;
    this.heading += this.filteredYawRate * delta;

    // 4. Wheel Visual Rotations (front steer, all spin)
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (w.isFront) {
        w.steerPivot.rotation.y = this.smoothedSteer;
      } else {
        w.steerPivot.rotation.y = 0;
      }
      w.spinPivot.rotation.x += (this.speed / w.radius) * delta;
    }

    // 5. Road Geometry, Centerline Offset & Lane Assist
    const roadTangent = roadData.tangent.clone().normalize();
    const roadNormal = new THREE.Vector3(-roadTangent.z, 0, roadTangent.x).normalize();
    const roadAngle = Math.atan2(roadTangent.x, roadTangent.z);

    const refZ = roadData.position ? roadData.position.z : this.position.z;
    const dx = this.position.x - roadData.x;
    const dz = this.position.z - refZ;
    this.currentLateralOffset = dx * roadNormal.x + dz * roadNormal.z;

    // Lane assist: soft pull toward lane center (strength ~0.15, scaled down when player steers)
    if (HANDLING.laneAssistEnabled && this.speed > 2.0) {
        const steerSuppression = Math.max(0, 1.0 - Math.abs(input.steer) * 2.5);
        if (steerSuppression > 0.05) {
            const currentLaneIdx = RoadLanes.getLaneIndex(1, this.currentLateralOffset);
            const laneCenter = RoadLanes.laneCenterLateralOffset(1, currentLaneIdx);
            const laneErr = this.currentLateralOffset - laneCenter;
            
            const pull = -laneErr * HANDLING.laneAssistStrength * steerSuppression;
            const targetAssistHeading = roadAngle + THREE.MathUtils.clamp(pull, -0.12, 0.12);

            let diff = targetAssistHeading - this.heading;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.heading += diff * Math.min(1.0, 3.0 * delta);
        }
    }

    // 6. World Position Translation
    this.velocity.set(
        Math.sin(this.heading) * this.speed,
        0,
        Math.cos(this.heading) * this.speed
    );
    this.position.x += this.velocity.x * delta;
    this.position.z += this.velocity.z * delta;

    // 7. Soft Road Shoulder / Curb Boundary
    const maxHalfWidth = 6.8;
    if (Math.abs(this.currentLateralOffset) > maxHalfWidth) {
        const clampedOffset = Math.sign(this.currentLateralOffset) * maxHalfWidth;
        this.position.x = roadData.x + roadNormal.x * clampedOffset;
        this.heading = THREE.MathUtils.lerp(this.heading, roadAngle, 0.10);
        this.speed *= 0.96; // soft curb scrub
        this.targetLaneOffset = clampedOffset;
    }

    // 8. Ground Snapping via Raycasting against Road Surface
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
    this.position.y = THREE.MathUtils.lerp(this.position.y, targetGroundY, Math.min(1.0, 18.0 * delta));
    this.model.position.copy(this.position);

    // 9. Surface Normal Alignment + Body Dynamics (Roll +/-1.5 deg, Pitch on accel/brake)
    this.groundNormal.lerp(hitNormal, Math.min(1.0, 12.0 * delta));
    const qSlope = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.groundNormal);
    const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    const targetQuat = qSlope.multiply(qYaw);

    // Small body roll (+/-1.5 deg) based on lateral acceleration / yawRate
    const targetRoll = THREE.MathUtils.clamp(
        - (this.filteredYawRate * this.speed / 9.81) * THREE.MathUtils.degToRad(HANDLING.bodyRollMaxDeg),
        -THREE.MathUtils.degToRad(HANDLING.bodyRollMaxDeg),
        THREE.MathUtils.degToRad(HANDLING.bodyRollMaxDeg)
    );
    this.rollAngle = THREE.MathUtils.lerp(this.rollAngle, targetRoll, Math.min(1.0, 8.0 * delta));

    // Pitch on accel / brake
    const targetPitch = - (this.smoothedThrottle * THREE.MathUtils.degToRad(HANDLING.pitchAccelDeg)) + 
                        (input.brake * THREE.MathUtils.degToRad(HANDLING.pitchBrakeDeg));
    this.pitchAngle = THREE.MathUtils.lerp(this.pitchAngle, targetPitch, Math.min(1.0, 10.0 * delta));

    const qDynamics = new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitchAngle, 0, this.rollAngle, 'YXZ'));
    targetQuat.multiply(qDynamics);

    this.model.quaternion.slerp(targetQuat, Math.min(1.0, 16.0 * delta));

    // 10. Taillight Brightness on Braking
    const isBraking = input.brake > 0.1;
    const tlIntensity = isBraking ? 4.5 : 1.5;
    for (let i = 0; i < this.taillightMaterials.length; i++) {
      this.taillightMaterials[i].emissiveIntensity = tlIntensity;
    }
  }

  public nudgeCollision(lateralSign: number = 1): void {
    this.speed *= (1.0 - HANDLING.collisionSpeedScrub); // scrubs speed by ~40%
    this.position.x += lateralSign * HANDLING.collisionNudgeLateral;
    this.heading += lateralSign * HANDLING.collisionNudgeYaw;
  }

  public shiftOrigin(offsetZ: number): void {
    this.position.z -= offsetZ;
    if (this.model) {
      this.model.position.z -= offsetZ;
    }
  }
}
