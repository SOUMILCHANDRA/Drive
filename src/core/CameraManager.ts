import * as THREE from 'three';

export type CameraMode = 'CHASE' | 'HOOD' | 'CINEMATIC';
export const CameraModes: CameraMode[] = ['CHASE', 'HOOD', 'CINEMATIC'];

/**
 * CameraManager: Orchestrates cinematic perspectives and lens calibration.
 */
export class CameraManager {
    private camera: THREE.PerspectiveCamera;
    public mode: CameraMode = 'CHASE';
    
    private targetPos: THREE.Vector3 = new THREE.Vector3();
    private currentLookAt: THREE.Vector3 = new THREE.Vector3();
    
    // Cinematic Offsets
    private readonly CHASE_OFFSET = new THREE.Vector3(0, 3.5, -10);
    private readonly CHASE_LOOK_OFFSET = new THREE.Vector3(0, 1, 5);
    private readonly HOOD_OFFSET = new THREE.Vector3(0, 1.1, 0.8);
    private readonly HOOD_LOOK_OFFSET = new THREE.Vector3(0, 1.1, 50);

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
        
        // Lens Calibration
        this.camera.near = 0.5;
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

    public update(delta: number, car: THREE.Group, speed: number): void {
        const speedFactor = speed / 45;
        
        // 1. Perspective Execution
        switch (this.mode) {
            case 'CHASE':
                this.updateChaseCam(car, delta);
                break;
            case 'HOOD':
                this.updateHoodCam(car, delta);
                break;
            case 'CINEMATIC':
                this.updateCinematicCam(car);
                break;
        }

        // 2. Visual Artifacts
        // FOV Breathing (Dynamic Lens Compression)
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 55 + speedFactor * 10, 0.1);
        this.camera.updateProjectionMatrix();

        // Speed-based vibration
        if (speed > 15) {
            const shake = speedFactor * 0.04;
            this.camera.position.x += (Math.random() - 0.5) * shake;
            this.camera.position.y += (Math.random() - 0.5) * shake;
        }
    }

    private updateChaseCam(car: THREE.Group, _delta: number): void {
        // Position: Behind and Above
        const worldOffset = this.CHASE_OFFSET.clone().applyQuaternion(car.quaternion);
        this.targetPos.copy(car.position).add(worldOffset);
        
        // Look Target: Slightly Ahead
        const lookTarget = car.position.clone().add(
            this.CHASE_LOOK_OFFSET.clone().applyQuaternion(car.quaternion)
        );

        // Smooth Follow
        this.camera.position.lerp(this.targetPos, 0.08);
        this.currentLookAt.lerp(lookTarget, 0.1);
        this.camera.lookAt(this.currentLookAt);
    }

    private updateHoodCam(car: THREE.Group, _delta: number): void {
        // Position: On the Hood
        const worldOffset = this.HOOD_OFFSET.clone().applyQuaternion(car.quaternion);
        this.targetPos.copy(car.position).add(worldOffset);
        
        // Look Target: Far Ahead
        const lookTarget = car.position.clone().add(
            this.HOOD_LOOK_OFFSET.clone().applyQuaternion(car.quaternion)
        );

        // Tighter Follow for Cockpit Stability
        this.camera.position.lerp(this.targetPos, 0.2);
        this.camera.lookAt(lookTarget);
    }

    private updateCinematicCam(car: THREE.Group): void {
        // Slow Orbit Shot
        const time = Date.now() * 0.0003;
        const orbitPos = new THREE.Vector3(
            Math.sin(time) * 18,
            3,
            Math.cos(time) * 18
        );
        this.camera.position.lerp(car.position.clone().add(orbitPos), 0.05);
        this.camera.lookAt(car.position);
    }

    public getModeIndex(): number { return CameraModes.indexOf(this.mode); }
}
