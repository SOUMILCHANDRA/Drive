import * as THREE from 'three';

export type CameraMode = 'CHASE' | 'HOOD' | 'CINEMATIC';

export const CameraModes: CameraMode[] = ['CHASE', 'HOOD', 'CINEMATIC'];

/**
 * CameraManager: Orchestrates cinematic perspectives, shake, and Dutch tilts.
 */
export class CameraManager {
    private camera: THREE.PerspectiveCamera;
    public mode: CameraMode = 'CHASE';

    public setMode(mode: any): void {
        if (typeof mode === 'number') {
            this.mode = CameraModes[mode % CameraModes.length];
        } else {
            this.mode = mode;
        }
    }

    public getModeIndex(): number {
        return CameraModes.indexOf(this.mode);
    }
    private targetPos: THREE.Vector3 = new THREE.Vector3();
    private currentLookAt: THREE.Vector3 = new THREE.Vector3();
    
    private shakeIntensity: number = 0;
    private dutchTilt: number = 0;
    private cinematicTimer: number = 0;
    private cinematicShot: 'ORBIT' | 'SIDE' = 'ORBIT';

    constructor(camera: THREE.PerspectiveCamera) {
        this.camera = camera;
    }

    public cycleMode(): void {
        const idx = CameraModes.indexOf(this.mode);
        this.mode = CameraModes[(idx + 1) % CameraModes.length];
        this.cinematicTimer = 0; // Reset for new mode
    }

    public update(delta: number, car: THREE.Group, speed: number, steer: number): void {
        const speedFactor = speed / 40;
        
        // 1. Perspective Selection
        switch (this.mode) {
            case 'CHASE':
                this.updateChaseCam(car, speedFactor);
                break;
            case 'HOOD':
                this.updateHoodCam(car);
                break;
            case 'CINEMATIC':
                this.updateCinematicCam(delta, car);
                break;
        }

        // 2. Cinematic Artifacts
        // FOV Breathing
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 55 + speedFactor * 7, 0.1);
        this.camera.updateProjectionMatrix();

        // Dutch Tilt on Cornering
        this.dutchTilt = THREE.MathUtils.lerp(this.dutchTilt, -steer * 0.04, 0.05);
        this.camera.rotation.z = this.dutchTilt;

        // Speed-based Shake
        if (speed > 10) {
            this.shakeIntensity = speedFactor * 0.05;
            this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
        }
    }

    private updateChaseCam(car: THREE.Group, _speedFactor: number): void {
        const back = new THREE.Vector3(0, 3, -10).applyQuaternion(car.quaternion);
        this.targetPos.copy(car.position).add(back);
        this.camera.position.lerp(this.targetPos, 0.08);
        
        const lookPos = car.position.clone().add(new THREE.Vector3(0, 1, 5).applyQuaternion(car.quaternion));
        this.currentLookAt.lerp(lookPos, 0.1);
        this.camera.lookAt(this.currentLookAt);
    }

    private updateHoodCam(car: THREE.Group): void {
        const hood = new THREE.Vector3(0, 1.3, 1).applyQuaternion(car.quaternion);
        this.camera.position.lerp(car.position.clone().add(hood), 0.2);
        
        const lookPos = car.position.clone().add(new THREE.Vector3(0, 1.2, 50).applyQuaternion(car.quaternion));
        this.camera.lookAt(lookPos);
    }

    private updateCinematicCam(delta: number, car: THREE.Group): void {
        this.cinematicTimer += delta;
        
        // Randomly cut between Orbit and Side shots every 4-6 seconds
        if (this.cinematicTimer > 5) {
            this.cinematicShot = Math.random() > 0.5 ? 'ORBIT' : 'SIDE';
            this.cinematicTimer = 0;
        }

        if (this.cinematicShot === 'ORBIT') {
            const time = Date.now() * 0.0005;
            const orbitPos = new THREE.Vector3(
                Math.sin(time) * 15,
                4,
                Math.cos(time) * 15
            );
            this.camera.position.lerp(car.position.clone().add(orbitPos), 0.05);
            this.camera.lookAt(car.position);
        } else {
            // Low Angle Side Shot
            const sidePos = new THREE.Vector3(12, 1, 5).applyQuaternion(car.quaternion);
            this.camera.position.lerp(car.position.clone().add(sidePos), 0.05);
            this.camera.lookAt(car.position);
        }
    }

    public getMode(): CameraMode { return this.mode; }
}
