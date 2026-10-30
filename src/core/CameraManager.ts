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
    private readonly CHASE_OFFSET = new THREE.Vector3(0, 2.15, -7.2);
    private readonly CHASE_LOOK_OFFSET = new THREE.Vector3(0, 0.75, 14);
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
        const speedFactor = speed / 48;
        
        switch (this.mode) {
            case 'CHASE':
                this.updateChaseCam(car);
                break;
            case 'HOOD':
                this.updateHoodCam(car);
                break;
            case 'CINEMATIC':
                this.updateCinematicCam(car);
                break;
        }

        // 1. Dynamic FOV Breathing
        const targetFov = 54 + speedFactor * 12;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.08);
        this.camera.updateProjectionMatrix();

        // 2. Camera Shake / Trauma Decay
        if (this.trauma > 0.001) {
            const shake = this.trauma * this.trauma * 0.4;
            this.camera.position.x += (Math.random() - 0.5) * shake;
            this.camera.position.y += (Math.random() - 0.5) * shake;
            this.trauma = Math.max(0, this.trauma - delta * 1.8);
        } else if (speed > 25) {
            const microShake = (speedFactor - 0.5) * 0.02;
            this.camera.position.x += (Math.random() - 0.5) * microShake;
            this.camera.position.y += (Math.random() - 0.5) * microShake;
        }
    }

    private isInitialized: boolean = false;

    private updateChaseCam(car: THREE.Group): void {
        const worldOffset = this.CHASE_OFFSET.clone().applyQuaternion(car.quaternion);
        this.targetPos.copy(car.position).add(worldOffset);
        
        const lookTarget = car.position.clone().add(
            this.CHASE_LOOK_OFFSET.clone().applyQuaternion(car.quaternion)
        );

        if (!this.isInitialized) {
            this.camera.position.copy(this.targetPos);
            this.currentLookAt.copy(lookTarget);
            this.isInitialized = true;
        } else {
            this.camera.position.lerp(this.targetPos, 0.14);
            this.currentLookAt.lerp(lookTarget, 0.18);
        }
        this.camera.lookAt(this.currentLookAt);
    }

    private updateHoodCam(car: THREE.Group): void {
        const worldOffset = this.HOOD_OFFSET.clone().applyQuaternion(car.quaternion);
        this.targetPos.copy(car.position).add(worldOffset);
        
        const lookTarget = car.position.clone().add(
            this.HOOD_LOOK_OFFSET.clone().applyQuaternion(car.quaternion)
        );

        this.camera.position.lerp(this.targetPos, 0.25);
        this.camera.lookAt(lookTarget);
    }

    private updateCinematicCam(car: THREE.Group): void {
        const time = Date.now() * 0.0003;
        const orbitPos = new THREE.Vector3(
            Math.sin(time) * 16,
            3.0,
            Math.cos(time) * 16
        );
        this.camera.position.lerp(car.position.clone().add(orbitPos), 0.06);
        this.camera.lookAt(car.position);
    }

    public getModeIndex(): number { 
        return CameraModes.indexOf(this.mode); 
    }
}
