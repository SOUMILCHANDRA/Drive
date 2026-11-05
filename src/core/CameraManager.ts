import * as THREE from 'three';

export type CameraMode = 'CHASE' | 'HOOD' | 'CINEMATIC';
export const CameraModes: CameraMode[] = ['CHASE', 'HOOD', 'CINEMATIC'];

/**
 * CameraManager: Orchestrates cinematic perspectives, lens breathing, and impact trauma.
 */
export class CameraManager {
    private camera: THREE.PerspectiveCamera;
    public mode: CameraMode = 'CHASE';
    
    private targetPos: THREE.Vector3 = new THREE.Vector3();
    private currentLookAt: THREE.Vector3 = new THREE.Vector3();
    
    // Cinematic Offsets (Calibrated low-slung cinematic chase camera)
    private readonly CHASE_OFFSET = new THREE.Vector3(0, 2.35, -8.2);
    private readonly CHASE_LOOK_OFFSET = new THREE.Vector3(0, 0.85, 14);
    private readonly HOOD_OFFSET = new THREE.Vector3(0, 1.1, 0.8);
    private readonly HOOD_LOOK_OFFSET = new THREE.Vector3(0, 1.1, 50);

    // Dynamic Camera Trauma / Shake
    private trauma: number = 0;

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
        this.camera.near = 0.3;
        this.camera.far = 3000;
        this.camera.updateProjectionMatrix();
    }

    public setMode(mode: CameraMode | number): void {
        if (typeof mode === 'number') {
            this.mode = CameraModes[mode % CameraModes.length];
        } else {
            this.mode = mode;
        }
    }

    public cycleMode(): void {
        const idx = CameraModes.indexOf(this.mode);
        this.mode = CameraModes[(idx + 1) % CameraModes.length];
    }

    public addTrauma(amount: number): void {
        this.trauma = Math.min(1.0, this.trauma + amount);
    }

    public update(delta: number, car: THREE.Group, speed: number): void {
        const speedKmh = speed * 3.6;
        const speedRatio = Math.min(1.0, speedKmh / 160);
        
        switch (this.mode) {
            case 'CHASE':
                this.updateChaseCam(car, delta);
                break;
            case 'HOOD':
                this.updateHoodCam(car, delta);
                break;
            case 'CINEMATIC':
                this.updateCinematicCam(car, delta);
                break;
        }

        // 1. Dynamic FOV: subtly widens with speed (60 -> 72)
        const targetFov = 60 + speedRatio * 12;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1.0, 5.0 * delta));
        this.camera.updateProjectionMatrix();

        // 2. Camera Shake / Trauma Decay (only on collision hits, no hard speed shake)
        if (this.trauma > 0.001) {
            const shake = this.trauma * this.trauma * 0.45;
            this.camera.position.x += (Math.random() - 0.5) * shake;
            this.camera.position.y += (Math.random() - 0.5) * shake;
            this.trauma = Math.max(0, this.trauma - delta * 2.0);
        }
    }

    private isInitialized: boolean = false;

    private updateChaseCam(car: THREE.Group, delta: number): void {
        const worldOffset = this.CHASE_OFFSET.clone().applyQuaternion(car.quaternion);
        this.targetPos.copy(car.position).add(worldOffset);
        
        // Turn look-ahead: looks further toward the inside of the turn
        const turnEuler = new THREE.Euler().setFromQuaternion(car.quaternion, 'YXZ');
        const turnYaw = Math.sin(turnEuler.y);
        const turnLookOffset = new THREE.Vector3(turnYaw * 3.0, 0, 0);

        const lookTarget = car.position.clone()
            .add(this.CHASE_LOOK_OFFSET.clone().applyQuaternion(car.quaternion))
            .add(turnLookOffset);

        if (!this.isInitialized) {
            this.camera.position.copy(this.targetPos);
            this.currentLookAt.copy(lookTarget);
            this.isInitialized = true;
        } else {
            // Critically-damped chase camera (position lag ~0.25 s)
            const blendPos = 1.0 - Math.exp(-delta / 0.25);
            const blendLook = 1.0 - Math.exp(-delta / 0.18);
            this.camera.position.lerp(this.targetPos, blendPos);
            this.currentLookAt.lerp(lookTarget, blendLook);
        }
        this.camera.lookAt(this.currentLookAt);
    }

    private updateHoodCam(car: THREE.Group, delta: number): void {
        const worldOffset = this.HOOD_OFFSET.clone().applyQuaternion(car.quaternion);
        this.targetPos.copy(car.position).add(worldOffset);
        
        const lookTarget = car.position.clone().add(
            this.HOOD_LOOK_OFFSET.clone().applyQuaternion(car.quaternion)
        );

        const blend = 1.0 - Math.exp(-delta / 0.10);
        this.camera.position.lerp(this.targetPos, blend);
        this.camera.lookAt(lookTarget);
    }

    private updateCinematicCam(car: THREE.Group, delta: number): void {
        const time = Date.now() * 0.0003;
        const orbitPos = new THREE.Vector3(
            Math.sin(time) * 16,
            3.0,
            Math.cos(time) * 16
        );
        const blend = 1.0 - Math.exp(-delta / 0.35);
        this.camera.position.lerp(car.position.clone().add(orbitPos), blend);
        this.camera.lookAt(car.position);
    }

    public getModeIndex(): number { 
        return CameraModes.indexOf(this.mode); 
    }

    public shiftOrigin(offsetZ: number): void {
        this.camera.position.z -= offsetZ;
        this.targetPos.z -= offsetZ;
        this.currentLookAt.z -= offsetZ;
    }
}
