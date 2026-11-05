import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoadLanes } from './RoadLanes';

export const TrafficDirection = {
    SAME_DIRECTION: 1,
    ONCOMING: -1
} as const;
export type TrafficDirection = typeof TrafficDirection[keyof typeof TrafficDirection];

/**
 * TrafficVehicleState: High-performance data structure tracking AI traffic simulation.
 * Visual rendering is batched into 4 global InstancedMeshes (<= 4 draw calls total).
 */
export class TrafficVehicleState {
    public index: number;
    public active: boolean = false;
    public direction: TrafficDirection = TrafficDirection.ONCOMING;
    public laneIndex: number = 0;
    public targetLaneIndex: number = 0;
    public speed: number = 0;
    public currentZ: number = 0;
    public currentLateralOffset: number = 0;
    public targetLateralOffset: number = 0;
    public lateralNoise: number = 0;
    public hasNearMissed: boolean = false;
    public hasCollided: boolean = false;

    // World transform cache for collision and camera interactions
    public worldPosition: THREE.Vector3 = new THREE.Vector3();
    public worldRotationY: number = 0;

    // Smooth lane changing for same-direction cars (over 1.5s)
    public isChangingLane: boolean = false;
    public laneChangeProgress: number = 0;
    public laneChangeTimer: number = 0;
    private laneChangeStartOffset: number = 0;

    constructor(index: number) {
        this.index = index;
    }

    public spawn(
        z: number,
        direction: TrafficDirection,
        laneIndex: number,
        speed: number,
        roadPos: THREE.Vector3,
        roadTangent: THREE.Vector3
    ): void {
        this.active = true;
        this.hasNearMissed = false;
        this.hasCollided = false;
        this.direction = direction;
        this.laneIndex = laneIndex;
        this.targetLaneIndex = laneIndex;
        this.speed = speed;
        this.currentZ = z;

        // Subtle lateral noise (+/- 0.15m)
        this.lateralNoise = (Math.random() - 0.5) * 0.3;
        this.targetLateralOffset = RoadLanes.laneCenterLateralOffset(this.direction, this.laneIndex) + this.lateralNoise;
        this.currentLateralOffset = this.targetLateralOffset;

        // Random timer before same-direction car considers lane change (5 - 12 s)
        this.isChangingLane = false;
        this.laneChangeProgress = 0;
        this.laneChangeTimer = 5.0 + Math.random() * 7.0;

        this.updateTransform(roadPos, roadTangent);
    }

    public startLaneChange(targetIndex: number): void {
        if (this.isChangingLane || targetIndex === this.laneIndex) return;
        this.isChangingLane = true;
        this.targetLaneIndex = targetIndex;
        this.laneChangeProgress = 0;
        this.laneChangeStartOffset = this.currentLateralOffset;
        this.targetLateralOffset = RoadLanes.laneCenterLateralOffset(this.direction, targetIndex) + this.lateralNoise;
    }

    public update(
        delta: number,
        getRoadPos: (z: number) => { position: THREE.Vector3; tangent: THREE.Vector3 }
    ): void {
        if (!this.active) return;

        // 1. Z-Position Motion
        if (this.direction === TrafficDirection.ONCOMING) {
            this.currentZ -= this.speed * delta; // Toward -Z
        } else {
            this.currentZ += this.speed * delta; // Ahead in +Z
        }

        // 2. Smooth Lane Change Transition (over 1.5s)
        if (this.isChangingLane) {
            this.laneChangeProgress += delta / 1.5;
            if (this.laneChangeProgress >= 1.0) {
                this.laneChangeProgress = 1.0;
                this.isChangingLane = false;
                this.laneIndex = this.targetLaneIndex;
                this.currentLateralOffset = this.targetLateralOffset;
            } else {
                const t = this.laneChangeProgress;
                const smoothT = t * t * (3 - 2 * t);
                this.currentLateralOffset = THREE.MathUtils.lerp(
                    this.laneChangeStartOffset,
                    this.targetLateralOffset,
                    smoothT
                );
            }
        }

        // 3. Update World Coordinates along road curve
        const roadInfo = getRoadPos(this.currentZ);
        this.updateTransform(roadInfo.position, roadInfo.tangent);
    }

    public updateTransform(roadPos: THREE.Vector3, roadTangent: THREE.Vector3): void {
        const tangent = roadTangent.clone().normalize();
        const roadNormal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const roadAngle = Math.atan2(tangent.x, tangent.z);

        this.worldPosition.set(
            roadPos.x + roadNormal.x * this.currentLateralOffset,
            roadPos.y,
            this.currentZ
        );

        if (this.direction === TrafficDirection.ONCOMING) {
            this.worldRotationY = roadAngle + Math.PI; // Face oncoming (-Z)
        } else {
            this.worldRotationY = roadAngle; // Face forward (+Z)
        }
    }

    public deactivate(): void {
        this.active = false;
        this.worldPosition.set(0, -9999, 0);
    }
}

/**
 * TrafficManager: Manages traffic pooling, lane assignments, collision detection,
 * and high-efficiency InstancedMesh rendering (< 4 draw calls total).
 */
export class TrafficManager {
    private scene: THREE.Scene;
    private maxPool: number = 24;
    private pool: TrafficVehicleState[] = [];
    public activeCars: TrafficVehicleState[] = [];
    private maxActiveCars: number = 10;
    private spawnCooldown: number = 0;

    // Batched Instanced Meshes (Exactly 4 draw calls for all traffic cars!)
    private chassisInstanced: THREE.InstancedMesh;
    private headlightsInstanced: THREE.InstancedMesh;
    private taillightsInstanced: THREE.InstancedMesh;
    private beamsInstanced: THREE.InstancedMesh;

    // Pooled SpotLights for the nearest 2 oncoming cars
    private oncomingSpotlights: { light: THREE.SpotLight; target: THREE.Object3D }[] = [];

    // Matrix helpers
    private tempMatrix = new THREE.Matrix4();
    private zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
    private tempQuat = new THREE.Quaternion();
    private tempScale = new THREE.Vector3(1, 1, 1);
    private yAxis = new THREE.Vector3(0, 1, 0);

    // Debug Visualization (F3): Lane Lines + Wireframe Car Boxes
    private debugLinesGreen: THREE.LineSegments;
    private debugLinesRed: THREE.LineSegments;
    private debugBoxes: THREE.LineSegments;
    private debugVisible: boolean = false;
    private diagLogTimer: number = 0;

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // 1. Build Merged Shared Geometries
        const body = new THREE.BoxGeometry(1.9, 0.72, 4.3);
        body.clearGroups();
        body.translate(0, 0.5, 0);
        const cabin = new THREE.BoxGeometry(1.5, 0.52, 2.3);
        cabin.clearGroups();
        cabin.translate(0, 0.95, -0.2);
        const chassisGeo = BufferGeometryUtils.mergeGeometries([body, cabin]);

        // Two bright headlight emissive quads (0.42m x 0.22m)
        const hl1 = new THREE.PlaneGeometry(0.42, 0.22);
        hl1.clearGroups();
        hl1.translate(-0.65, 0.58, 2.18);
        const hl2 = new THREE.PlaneGeometry(0.42, 0.22);
        hl2.clearGroups();
        hl2.translate(0.65, 0.58, 2.18);
        const headlightsGeo = BufferGeometryUtils.mergeGeometries([hl1, hl2]);

        // Two bright taillight emissive quads (0.42m x 0.22m)
        const tl1 = new THREE.PlaneGeometry(0.42, 0.22);
        tl1.clearGroups();
        tl1.rotateY(Math.PI);
        tl1.translate(-0.65, 0.58, -2.18);
        const tl2 = new THREE.PlaneGeometry(0.42, 0.22);
        tl2.clearGroups();
        tl2.rotateY(Math.PI);
        tl2.translate(0.65, 0.58, -2.18);
        const taillightsGeo = BufferGeometryUtils.mergeGeometries([tl1, tl2]);

        // Volumetric headlight cones
        const b1 = new THREE.ConeGeometry(2.0, 22, 28, 1, true);
        b1.rotateX(-Math.PI / 2);
        b1.translate(-0.65, 0.58, 13.18);
        const b2 = new THREE.ConeGeometry(2.0, 22, 28, 1, true);
        b2.rotateX(-Math.PI / 2);
        b2.translate(0.65, 0.58, 13.18);
        const beamsGeo = BufferGeometryUtils.mergeGeometries([b1, b2]);

        // 2. Materials (Bug 2: readable at night with base #2a2a3a, envMap, and Fresnel #4466ff rim)
        const chassisMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a3a,
            roughness: 0.4,
            metalness: 0.5,
            envMapIntensity: 1.5
        });

        // Inject faint cool Fresnel rim light (#4466ff) into chassis shader
        chassisMat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <opaque_fragment>',
                `
                // Faint cool rim light (Fresnel, color #4466ff)
                float rimDot = 1.0 - saturate(dot(geometryNormal, geometryViewDir));
                float rimFactor = pow(rimDot, 3.0);
                outgoingLight += vec3(0.267, 0.4, 1.0) * rimFactor * 0.45;
                #include <opaque_fragment>
                `
            );
        };

        const headlightMat = new THREE.MeshBasicMaterial({
            color: 0xfff4d6,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const taillightMat = new THREE.MeshBasicMaterial({
            color: 0xff1e1e,
            transparent: true,
            opacity: 0.95,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });

        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xfff4d6,
            transparent: true,
            opacity: 0.07,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide
        });

        // 3. Create InstancedMeshes
        this.chassisInstanced = new THREE.InstancedMesh(chassisGeo, chassisMat, this.maxPool);
        this.headlightsInstanced = new THREE.InstancedMesh(headlightsGeo, headlightMat, this.maxPool);
        this.taillightsInstanced = new THREE.InstancedMesh(taillightsGeo, taillightMat, this.maxPool);
        this.beamsInstanced = new THREE.InstancedMesh(beamsGeo, beamMat, this.maxPool);

        // BUG 2 FIX: Disable frustum culling on InstancedMeshes so Three.js doesn't cull entire highway traffic
        this.chassisInstanced.frustumCulled = false;
        this.headlightsInstanced.frustumCulled = false;
        this.taillightsInstanced.frustumCulled = false;
        this.beamsInstanced.frustumCulled = false;

        this.chassisInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.headlightsInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.taillightsInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.beamsInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        for (let i = 0; i < this.maxPool; i++) {
            this.chassisInstanced.setMatrixAt(i, this.zeroMatrix);
            this.headlightsInstanced.setMatrixAt(i, this.zeroMatrix);
            this.taillightsInstanced.setMatrixAt(i, this.zeroMatrix);
            this.beamsInstanced.setMatrixAt(i, this.zeroMatrix);
            this.pool.push(new TrafficVehicleState(i));
        }

        this.scene.add(
            this.chassisInstanced,
            this.headlightsInstanced,
            this.taillightsInstanced,
            this.beamsInstanced
        );

        // 4. Pooled SpotLights for the nearest 2 oncoming cars
        for (let s = 0; s < 2; s++) {
            const spot = new THREE.SpotLight(0xfff4d6, 0, 75, 0.48, 0.7, 1.4);
            spot.castShadow = false;
            const target = new THREE.Object3D();
            this.scene.add(spot);
            this.scene.add(target);
            spot.target = target;
            this.oncomingSpotlights.push({ light: spot, target });
        }

        // 5. Colored Debug Lane Lines & 3D Car Wireframe Boxes (F3)
        this.debugLinesGreen = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.9 })
        );
        this.debugLinesRed = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0xff2244, transparent: true, opacity: 0.9 })
        );
        this.debugBoxes = new THREE.LineSegments(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({ color: 0xffff33, transparent: true, opacity: 0.95 })
        );
        this.debugLinesGreen.visible = false;
        this.debugLinesRed.visible = false;
        this.debugBoxes.visible = false;
        this.scene.add(this.debugLinesGreen, this.debugLinesRed, this.debugBoxes);
    }

    public setEnvMap(envMap: THREE.Texture | THREE.RenderTarget | null): void {
        if (this.chassisInstanced && this.chassisInstanced.material) {
            const mat = this.chassisInstanced.material as THREE.MeshStandardMaterial;
            mat.envMap = (envMap as any)?.texture || (envMap as THREE.Texture) || null;
            mat.needsUpdate = true;
        }
    }

    public setDebugVisible(visible: boolean): void {
        this.debugVisible = visible;
        this.debugLinesGreen.visible = visible;
        this.debugLinesRed.visible = visible;
        this.debugBoxes.visible = visible;
    }

    public getActiveOncomingCount(): number {
        let count = 0;
        for (let i = 0; i < this.activeCars.length; i++) {
            if (this.activeCars[i].direction === TrafficDirection.ONCOMING) count++;
        }
        return count;
    }

    public getActiveSameDirCount(): number {
        let count = 0;
        for (let i = 0; i < this.activeCars.length; i++) {
            if (this.activeCars[i].direction === TrafficDirection.SAME_DIRECTION) count++;
        }
        return count;
    }

    public getNearestCarDistance(playerZ: number): number | null {
        let minDist: number | null = null;
        for (let i = 0; i < this.activeCars.length; i++) {
            const dist = Math.abs(this.activeCars[i].currentZ - playerZ);
            if (minDist === null || dist < minDist) {
                minDist = dist;
            }
        }
        return minDist;
    }

    public update(
        delta: number,
        playerZ: number,
        playerLateralOffset: number,
        getRoadPos: (z: number) => { position: THREE.Vector3; tangent: THREE.Vector3 }
    ): void {
        this.spawnCooldown -= delta;

        // 1. Spawning Logic
        if (this.spawnCooldown <= 0 && this.activeCars.length < this.maxActiveCars) {
            this.attemptSpawn(playerZ, playerLateralOffset, getRoadPos);
            this.spawnCooldown = 0.8 + Math.random() * 0.8;
        }

        // 2. Active Cars Update & Adaptive Speed Cruise (ensures gap >= 40m maintained)
        for (let i = this.activeCars.length - 1; i >= 0; i--) {
            const car = this.activeCars[i];
            car.update(delta, getRoadPos);

            // Adaptive Cruise Control (Speed matching with lead vehicle in same lane)
            this.applyAdaptiveCruise(car);

            // Lane Change for same-direction cars in lane 0
            if (car.direction === TrafficDirection.SAME_DIRECTION && car.laneIndex === 0 && !car.isChangingLane) {
                car.laneChangeTimer -= delta;
                if (car.laneChangeTimer <= 0) {
                    car.laneChangeTimer = 6.0 + Math.random() * 6.0;
                    // Check if adjacent right-side lane (lane 1) has a clear 50m window
                    if (this.isLaneWindowClear(TrafficDirection.SAME_DIRECTION, 1, car.currentZ, 50, car)) {
                        car.startLaneChange(1);
                    }
                }
            }

            // Despawn checks: 60m behind player or beyond fog distance (420m)
            const behindPlayer = car.currentZ < playerZ - 60;
            const beyondFog = car.currentZ > playerZ + 420 || car.currentZ < playerZ - 100;

            if (behindPlayer || beyondFog) {
                car.deactivate();
                this.activeCars.splice(i, 1);
                this.updateInstanceMatrix(car);
            }
        }

        // 3. Batch Update Instanced Meshes for Active Cars
        for (let i = 0; i < this.activeCars.length; i++) {
            this.updateInstanceMatrix(this.activeCars[i]);
        }

        this.chassisInstanced.instanceMatrix.needsUpdate = true;
        this.headlightsInstanced.instanceMatrix.needsUpdate = true;
        this.taillightsInstanced.instanceMatrix.needsUpdate = true;
        this.beamsInstanced.instanceMatrix.needsUpdate = true;

        // 4. Update pooled oncoming headlights for nearest 2 oncoming cars
        this.updateOncomingSpotlights(playerZ);

        // 5. Update Debug Lane Lines and 3D Bounding Boxes (F3) if visible
        if (this.debugVisible) {
            this.updateDebugLines(playerZ, getRoadPos);
            this.updateDebugBoxes();
        }

        // 6. Periodic Diagnostic Logging (Bug 2: log per traffic car properties)
        this.diagLogTimer += delta;
        if (this.diagLogTimer >= 3.0) {
            this.diagLogTimer = 0;
            this.logTrafficDiagnostics(playerZ);
        }
    }

    /**
     * Adaptive Cruise Control: prevents cars in the same lane from closing the gap below 40m.
     */
    private applyAdaptiveCruise(car: TrafficVehicleState): void {
        const safeGap = 45.0; // Target minimum gap

        for (let i = 0; i < this.activeCars.length; i++) {
            const other = this.activeCars[i];
            if (other === car || !other.active) continue;

            if (other.direction === car.direction && other.laneIndex === car.laneIndex) {
                if (car.direction === TrafficDirection.SAME_DIRECTION) {
                    // Both traveling +Z: check if other is ahead
                    if (other.currentZ > car.currentZ) {
                        const gap = other.currentZ - car.currentZ;
                        if (gap < safeGap) {
                            car.speed = Math.min(car.speed, other.speed * 0.95);
                        }
                    }
                } else {
                    // Both traveling -Z: other is ahead if other.currentZ < car.currentZ
                    if (other.currentZ < car.currentZ) {
                        const gap = car.currentZ - other.currentZ;
                        if (gap < safeGap) {
                            car.speed = Math.min(car.speed, other.speed * 0.95);
                        }
                    }
                }
            }
        }
    }

    private updateInstanceMatrix(car: TrafficVehicleState): void {
        const idx = car.index;
        if (!car.active) {
            this.chassisInstanced.setMatrixAt(idx, this.zeroMatrix);
            this.headlightsInstanced.setMatrixAt(idx, this.zeroMatrix);
            this.taillightsInstanced.setMatrixAt(idx, this.zeroMatrix);
            this.beamsInstanced.setMatrixAt(idx, this.zeroMatrix);
            return;
        }

        this.tempQuat.setFromAxisAngle(this.yAxis, car.worldRotationY);
        this.tempMatrix.compose(car.worldPosition, this.tempQuat, this.tempScale);

        this.chassisInstanced.setMatrixAt(idx, this.tempMatrix);

        if (car.direction === TrafficDirection.ONCOMING) {
            // Oncoming: front headlights & beams visible, taillights hidden
            this.headlightsInstanced.setMatrixAt(idx, this.tempMatrix);
            this.beamsInstanced.setMatrixAt(idx, this.tempMatrix);
            this.taillightsInstanced.setMatrixAt(idx, this.zeroMatrix);
        } else {
            // Same-direction: red taillights visible, headlights/beams hidden
            this.taillightsInstanced.setMatrixAt(idx, this.tempMatrix);
            this.headlightsInstanced.setMatrixAt(idx, this.zeroMatrix);
            this.beamsInstanced.setMatrixAt(idx, this.zeroMatrix);
        }
    }

    private attemptSpawn(
        playerZ: number,
        playerLateralOffset: number,
        getRoadPos: (z: number) => { position: THREE.Vector3; tangent: THREE.Vector3 }
    ): void {
        const car = this.pool.find(c => !c.active);
        if (!car) return;

        // Spawn probability: ~60% oncoming, ~40% same-direction
        const isOncoming = Math.random() < 0.6;
        const direction = isOncoming ? TrafficDirection.ONCOMING : TrafficDirection.SAME_DIRECTION;

        // Pick candidate lane index (0 = near yellow line, 1 = near shoulder)
        const candidateLane = Math.random() < 0.5 ? 0 : 1;

        // Spawn distance ahead: 250 - 400 m
        const spawnDistance = 250 + Math.random() * 150;
        const spawnZ = playerZ + spawnDistance;

        // Rule: Never spawn in the player's lane within 150m of the player
        const playerLane = RoadLanes.getLaneIndex(TrafficDirection.SAME_DIRECTION, playerLateralOffset);
        if (direction === TrafficDirection.SAME_DIRECTION && candidateLane === playerLane) {
            if (Math.abs(spawnZ - playerZ) < 150) {
                return;
            }
        }

        // Rule: Minimum gap between cars in the same lane: 40 m (use 50m buffer at spawn)
        if (!this.isLaneWindowClear(direction, candidateLane, spawnZ, 50)) {
            return;
        }

        // Speed settings:
        // Oncoming: 20 - 35 m/s
        // Same-direction: 8 - 18 m/s (slower than player)
        let speed: number;
        if (direction === TrafficDirection.ONCOMING) {
            speed = 20 + Math.random() * 15;
        } else {
            speed = 8 + Math.random() * 10;
        }

        const roadInfo = getRoadPos(spawnZ);
        car.spawn(spawnZ, direction, candidateLane, speed, roadInfo.position, roadInfo.tangent);
        this.activeCars.push(car);
        this.updateInstanceMatrix(car);
    }

    private isLaneWindowClear(
        direction: TrafficDirection,
        laneIndex: number,
        checkZ: number,
        gap: number,
        excludeCar?: TrafficVehicleState
    ): boolean {
        for (let i = 0; i < this.activeCars.length; i++) {
            const other = this.activeCars[i];
            if (other === excludeCar || !other.active) continue;

            if (other.direction === direction) {
                const otherLane = other.isChangingLane ? other.targetLaneIndex : other.laneIndex;
                if (otherLane === laneIndex) {
                    if (Math.abs(other.currentZ - checkZ) < gap) {
                        return false;
                    }
                }
            }
        }
        return true;
    }

    /**
     * Checks for collisions or near misses with the player vehicle.
     */
    public checkPlayerInteraction(playerPos: THREE.Vector3): { collided: boolean; nearMiss: boolean } {
        let collided = false;
        let nearMiss = false;

        for (let i = 0; i < this.activeCars.length; i++) {
            const car = this.activeCars[i];
            if (!car.active) continue;

            const dz = Math.abs(car.currentZ - playerPos.z);
            const dx = Math.abs(car.worldPosition.x - playerPos.x);

            // Bounding collision box (4.0m length, 2.0m width)
            if (dz < 4.0 && dx < 2.0 && !car.hasCollided) {
                car.hasCollided = true;
                collided = true;
            } else if (dz < 5.0 && dx < 3.6 && !car.hasNearMissed && !car.hasCollided) {
                car.hasNearMissed = true;
                nearMiss = true;
            }
        }

        return { collided, nearMiss };
    }

    /**
     * Draws colored lane-center lines in debug mode:
     * Green = Player direction lanes (+1), Red = Oncoming lanes (-1).
     */
    private updateDebugLines(
        playerZ: number,
        getRoadPos: (z: number) => { position: THREE.Vector3; tangent: THREE.Vector3 }
    ): void {
        const startZ = Math.max(0, playerZ - 60);
        const endZ = playerZ + 350;
        const stepZ = 10;
        const steps = Math.floor((endZ - startZ) / stepZ);

        const greenPositions: number[] = [];
        const redPositions: number[] = [];

        for (let i = 0; i < steps; i++) {
            const z1 = startZ + i * stepZ;
            const z2 = z1 + stepZ;

            const r1 = getRoadPos(z1);
            const r2 = getRoadPos(z2);

            const n1 = new THREE.Vector3(-r1.tangent.z, 0, r1.tangent.x).normalize();
            const n2 = new THREE.Vector3(-r2.tangent.z, 0, r2.tangent.x).normalize();

            // Player direction lanes (Green): Lane 0 & Lane 1
            for (let lane = 0; lane < RoadLanes.lanesPerDirection; lane++) {
                const offset = RoadLanes.laneCenterLateralOffset(TrafficDirection.SAME_DIRECTION, lane);
                greenPositions.push(
                    r1.position.x + n1.x * offset, r1.position.y + 0.12, z1,
                    r2.position.x + n2.x * offset, r2.position.y + 0.12, z2
                );
            }

            // Oncoming direction lanes (Red): Lane 0 & Lane 1
            for (let lane = 0; lane < RoadLanes.lanesPerDirection; lane++) {
                const offset = RoadLanes.laneCenterLateralOffset(TrafficDirection.ONCOMING, lane);
                redPositions.push(
                    r1.position.x + n1.x * offset, r1.position.y + 0.12, z1,
                    r2.position.x + n2.x * offset, r2.position.y + 0.12, z2
                );
            }
        }

        this.debugLinesGreen.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(greenPositions, 3)
        );
        this.debugLinesRed.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(redPositions, 3)
        );
    }

    /**
     * Updates pooled SpotLights for the nearest 2 oncoming cars facing the player.
     */
    private updateOncomingSpotlights(playerZ: number): void {
        const oncomingCars = this.activeCars
            .filter(c => c.direction === TrafficDirection.ONCOMING && c.currentZ > playerZ - 20)
            .sort((a, b) => (a.currentZ - playerZ) - (b.currentZ - playerZ));

        for (let i = 0; i < this.oncomingSpotlights.length; i++) {
            const spot = this.oncomingSpotlights[i];
            if (i < oncomingCars.length) {
                const car = oncomingCars[i];
                spot.light.position.set(car.worldPosition.x, car.worldPosition.y + 0.65, car.worldPosition.z);
                // Aim headlight forward in vehicle travel direction (-Z) toward player
                spot.target.position.set(car.worldPosition.x, car.worldPosition.y - 0.2, car.worldPosition.z - 35);
                spot.light.intensity = 4.8;
            } else {
                spot.light.intensity = 0;
            }
        }
    }

    /**
     * Draws a wireframe 3D bounding box (F3) around each active traffic car.
     */
    private updateDebugBoxes(): void {
        const boxPositions: number[] = [];

        // Box half-extents (2.0m width, 1.3m height, 4.4m length)
        const hw = 1.0;
        const hh = 1.25;
        const hl = 2.2;

        const cornersLocal = [
            new THREE.Vector3(-hw, 0.05, -hl),
            new THREE.Vector3(hw, 0.05, -hl),
            new THREE.Vector3(hw, 0.05, hl),
            new THREE.Vector3(-hw, 0.05, hl),
            new THREE.Vector3(-hw, hh, -hl),
            new THREE.Vector3(hw, hh, -hl),
            new THREE.Vector3(hw, hh, hl),
            new THREE.Vector3(-hw, hh, hl)
        ];

        const edgeIndices = [
            0, 1, 1, 2, 2, 3, 3, 0, // bottom loop
            4, 5, 5, 6, 6, 7, 7, 4, // top loop
            0, 4, 1, 5, 2, 6, 3, 7  // vertical pillars
        ];

        for (let i = 0; i < this.activeCars.length; i++) {
            const car = this.activeCars[i];
            if (!car.active) continue;

            const carMatrix = new THREE.Matrix4().compose(
                car.worldPosition,
                new THREE.Quaternion().setFromAxisAngle(this.yAxis, car.worldRotationY),
                this.tempScale
            );

            const cornersWorld = cornersLocal.map(c => c.clone().applyMatrix4(carMatrix));

            for (let e = 0; e < edgeIndices.length; e += 2) {
                const c1 = cornersWorld[edgeIndices[e]];
                const c2 = cornersWorld[edgeIndices[e + 1]];
                boxPositions.push(c1.x, c1.y, c1.z, c2.x, c2.y, c2.z);
            }
        }

        this.debugBoxes.geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(boxPositions, 3)
        );
    }

    /**
     * Logs per-car diagnostic telemetry to verify visibility, bounds, transforms, and culling state.
     */
    public logTrafficDiagnostics(playerZ: number): void {
        if (this.activeCars.length === 0) return;
        console.log(`[TRAFFIC DIAGNOSTICS] Active Cars: ${this.activeCars.length}, Player Z: ${playerZ.toFixed(1)}m`);
        console.log(`[TRAFFIC MESH] InstancedMesh - frustumCulled: ${this.chassisInstanced.frustumCulled}, visible: ${this.chassisInstanced.visible}, parent: ${this.chassisInstanced.parent?.type}`);
        for (let i = 0; i < this.activeCars.length; i++) {
            const car = this.activeCars[i];
            const dir = car.direction === TrafficDirection.ONCOMING ? 'ONCOMING' : 'SAME_DIR';
            const dist = (car.currentZ - playerZ).toFixed(1);
            console.log(`  Car #${car.index} (${dir}) - Pos: (${car.worldPosition.x.toFixed(2)}, ${car.worldPosition.y.toFixed(2)}, ${car.worldPosition.z.toFixed(2)}), Dist: ${dist}m, Scale: (1,1,1), frustumCulled: false, Side: Front/Double, Bounds: [x: ±1.0, y: [0, 1.25], z: ±2.2]`);
        }
    }

    public shiftOrigin(offsetZ: number): void {
        for (let i = 0; i < this.activeCars.length; i++) {
            const car = this.activeCars[i];
            car.currentZ -= offsetZ;
            car.worldPosition.z -= offsetZ;
        }
    }
}
