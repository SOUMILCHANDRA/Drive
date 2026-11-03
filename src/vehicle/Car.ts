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
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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
  private volumetricBeams: THREE.Mesh[] = [];
  private taillightFlares: THREE.Mesh[] = [];
  private headlightFlares: THREE.Mesh[] = [];

  // Wheel Hierarchy Assembly (Bug 1 Fix: 4-tier anchor -> steer -> spin -> mesh)
  private wheels: WheelAssembly[] = [];
  private steerAngle: number = 0;

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

        // Wrap GLB in parent Group and rotate child by Math.PI so it faces +Z
        carModel.rotation.y = Math.PI;
        
        const wheelMeshes: THREE.Mesh[] = [];

        const toRemove: THREE.Object3D[] = [];
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
            const isOldWheelMesh = name.includes('lod0_wheel') || name.includes('lod0che_chevelle_70_lod0_wheel');
            const isUnseenDetail = name.includes('undercarriage') ||
                                   name.includes('under_') ||
                                   name.includes('rubber') ||
                                   name.includes('weatherstrip') ||
                                   name.includes('plastic') ||
                                   name.includes('matte_colors') ||
                                   name.includes('emblem') ||
                                   name.includes('frame') ||
                                   name.includes('exhaust') ||
                                   name.includes('int_glass');

            if (isInterior || isOldWheelMesh || isUnseenDetail) {
              child.visible = false;
              toRemove.push(child);
              return;
            }

            if (name.includes('wheel5a')) {
              wheelMeshes.push(child);
              return;
            }

            const isMainBody = name.includes('body_body') || 
                               name.includes('trunk_body') || 
                               name.includes('bumper');
            child.castShadow = isMainBody;
            child.receiveShadow = true;
            if (child.geometry) child.geometry.clearGroups();
            
            if (child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              for (const mat of mats) {
                const anyMat = mat as any;
                if (anyMat.transmission !== undefined) anyMat.transmission = 0;
                if (anyMat.side === THREE.DoubleSide) anyMat.side = THREE.FrontSide;
                anyMat.forceSinglePass = true;
                if (anyMat.color) {
                    const r = anyMat.color.r;
                    const g = anyMat.color.g;
                    const b = anyMat.color.b;
                    anyMat.color.setRGB(Math.max(0.15, r), Math.max(0.15, g), Math.max(0.15, b));
                }
                anyMat.roughness = Math.min(anyMat.roughness ?? 0.4, 0.7);
                anyMat.metalness = Math.max(anyMat.metalness ?? 0.4, 0.75);
                anyMat.envMapIntensity = 1.6;
                anyMat.needsUpdate = true;
              }
            }
          }
        });

        for (const child of toRemove) {
          if (child.parent) child.parent.remove(child);
          if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose();
        }

        // Re-center model inside wrapper Group so pivot sits at bottom center between wheels
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

        // Merge static car body submeshes sharing materials (drops 20+ draw calls)
        const staticMeshes: THREE.Mesh[] = [];
        carModel.traverse((child) => {
          if (child instanceof THREE.Mesh && !wheelMeshes.includes(child)) {
            staticMeshes.push(child);
          }
        });

        const matGroups = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[]; castShadow: boolean }>();
        for (const sm of staticMeshes) {
          sm.updateMatrixWorld(true);
          const g = sm.geometry.clone();
          const localMat = sm.matrix.clone();
          let p = sm.parent;
          while (p && p !== carModel) {
            localMat.premultiply(p.matrix);
            p = p.parent;
          }
          g.applyMatrix4(localMat);
          g.clearGroups();

          const mat = (Array.isArray(sm.material) ? sm.material[0] : sm.material) as THREE.Material;
          const key = mat.uuid;
          if (!matGroups.has(key)) {
            matGroups.set(key, { material: mat, geometries: [], castShadow: sm.castShadow });
          }
          const grp = matGroups.get(key)!;
          grp.geometries.push(g);
          if (sm.castShadow) grp.castShadow = true;

          if (sm.parent) sm.parent.remove(sm);
        }

        for (const { material, geometries, castShadow } of matGroups.values()) {
          const merged = geometries.length === 1 ? geometries[0] : BufferGeometryUtils.mergeGeometries(geometries);
          if (merged) {
            merged.clearGroups();
            const mergedMesh = new THREE.Mesh(merged, material);
            mergedMesh.castShadow = castShadow;
            mergedMesh.receiveShadow = true;
            mergedMesh.matrixAutoUpdate = true;
            carModel.add(mergedMesh);
          }
        }

        // Build rigid 4-tier wheel assemblies anchored to carRoot (Bug 1 Fix)
        this.model.updateMatrixWorld(true);
        this.wheels = [];

        for (const origMesh of wheelMeshes) {
          origMesh.updateMatrixWorld(true);
          const geom = origMesh.geometry.clone();
          geom.applyMatrix4(origMesh.matrixWorld);

          geom.computeBoundingBox();
          const wBox = geom.boundingBox!;
          const axlePos = new THREE.Vector3();
          wBox.getCenter(axlePos);
          const wSize = new THREE.Vector3();
          wBox.getSize(wSize);
          const radius = wSize.y * 0.5;

          // Re-center geometry around (0, 0, 0)
          geom.center();
          geom.clearGroups();

          // Detach from carModel so it cannot be affected by any nested parent rotation
          if (origMesh.parent) {
            origMesh.parent.remove(origMesh);
          }

          const wMat = origMesh.material as any;
          if (wMat) {
            if (wMat.transmission !== undefined) wMat.transmission = 0;
            wMat.forceSinglePass = true;
          }

          const wheelMesh = new THREE.Mesh(geom, origMesh.material);
          wheelMesh.name = origMesh.name + '_mesh';
          wheelMesh.castShadow = true;
          wheelMesh.receiveShadow = true;
          wheelMesh.matrixAutoUpdate = true;

          const spinPivot = new THREE.Object3D();
          spinPivot.name = origMesh.name + '_spinPivot';
          spinPivot.matrixAutoUpdate = true;
          spinPivot.add(wheelMesh);

          const steerPivot = new THREE.Object3D();
          steerPivot.name = origMesh.name + '_steerPivot';
          steerPivot.matrixAutoUpdate = true;
          steerPivot.add(spinPivot);

          const wheelAnchor = new THREE.Object3D();
          wheelAnchor.name = origMesh.name + '_wheelAnchor';
          wheelAnchor.position.copy(axlePos);
          wheelAnchor.matrixAutoUpdate = true;
          wheelAnchor.add(steerPivot);

          this.model.add(wheelAnchor);

          const isFront = axlePos.z > 0;
          this.wheels.push({
            name: origMesh.name,
            isFront,
            radius: Math.max(0.1, radius),
            wheelAnchor,
            steerPivot,
            spinPivot,
            wheelMesh
          });
        }

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

    // Front Headlight Glowing Lens Flare Plates (direct children of carRoot)
    const hlFlareGeo = new THREE.PlaneGeometry(0.35, 0.35);
    const hlFlareMat = new THREE.MeshBasicMaterial({
      color: 0xfff6dc,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    [-0.7, 0.7].forEach(x => {
      const flare = new THREE.Mesh(hlFlareGeo, hlFlareMat);
      flare.position.set(x, 0.65, 2.22);
      this.model!.add(flare);
      this.headlightFlares.push(flare);
    });

    // Thin volumetric cone beams: ConeGeometry with 36 radial segments, reaches ~25m forward
    const coneRadius = 2.4;
    const coneHeight = 25.0;
    const beamGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 36, 1, true);
    // Rotate so apex is at origin and expands forward along +Z
    beamGeo.rotateX(-Math.PI / 2);
    beamGeo.translate(0, 0, coneHeight * 0.5);

    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff2cc,
      transparent: true,
      opacity: 0.05,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide
    });

    [-0.7, 0.7].forEach((x, idx) => {
      const beam = new THREE.Mesh(beamGeo, beamMat);
      // Positioned at lamp bezels and angled slightly down toward road to avoid hood clipping/spikes
      beam.position.set(x, 0.62, 2.24);
      beam.rotation.x = 0.025;
      beam.rotation.y = idx === 0 ? -0.01 : 0.01;
      this.model!.add(beam);
      this.volumetricBeams.push(beam);
    });

    // Taillight Glowing Lens Flare Plates (direct children of carRoot, no giant ground glow blobs)
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

    // 2. Responsive Steering Scale & Interactive Front Wheel Turn (Bug 1 Fix)
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

    // Clamp steerAngle to +/-0.5 rad and lerp smoothly
    const targetSteerAngle = THREE.MathUtils.clamp(input.steer * 0.45, -0.5, 0.5);
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteerAngle, Math.min(1.0, 14.0 * delta));

    // Update wheel pivots strictly: front wheels steer, all wheels spin, NEVER set runtime position
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (w.isFront) {
        w.steerPivot.rotation.y = this.steerAngle;
      } else {
        w.steerPivot.rotation.y = 0;
      }
      w.spinPivot.rotation.x += (this.speed / w.radius) * delta;
    }

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
    const flareOpacity = input.brake > 0.1 ? 1.0 : 0.6;
    const flareScale = input.brake > 0.1 ? 1.35 : 1.0;
    for (let i = 0; i < this.taillightFlares.length; i++) {
      (this.taillightFlares[i].material as THREE.MeshBasicMaterial).opacity = flareOpacity;
      this.taillightFlares[i].scale.set(flareScale, flareScale, 1.0);
    }
  }
}
