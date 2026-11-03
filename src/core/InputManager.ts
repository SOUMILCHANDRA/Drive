import * as THREE from 'three';

export interface InputState {
    steer: number;
    throttle: number;
    brake: number;
    cameraToggle: boolean;
    pause: boolean;
}

/**
 * InputManager: Unified controller for Keyboard, Gamepad, Touch, and Analog Smoothing.
 */
export class InputManager {
    public state: InputState = {
        steer: 0,
        throttle: 0,
        brake: 0,
        cameraToggle: false,
        pause: false
    };

    public keys: Record<string, boolean> = {};
    public touchStates = { left: false, right: false, accel: false, brake: false };
    public targetSteer: number = 0;
    public currentSteer: number = 0;
    private isTouch: boolean;

    constructor() {
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            this.keys[e.code] = true;
            if (e.key === 'Escape') this.state.pause = !this.state.pause;
            if (e.key.toLowerCase() === 'c') this.state.cameraToggle = true;
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            this.keys[e.code] = false;
        });

        if (this.isTouch) {
            this.initTouch();
        }
    }

    private initTouch(): void {
        const bind = (id: string, key: keyof typeof this.touchStates) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchStates[key] = true; }, { passive: false });
            el.addEventListener('touchend', (e) => { e.preventDefault(); this.touchStates[key] = false; }, { passive: false });
            el.addEventListener('touchcancel', (e) => { e.preventDefault(); this.touchStates[key] = false; }, { passive: false });
        };

        bind('touch-left', 'left');
        bind('touch-right', 'right');
        bind('touch-accel', 'accel');
        bind('touch-brake', 'brake');
    }

    public update(delta: number): InputState {
        this.updateKeyboard();
        this.updateGamepad();
        this.applyAnalogSmoothing(delta);
        
        // Reset single-frame triggers
        const result = { ...this.state };
        this.state.cameraToggle = false;
        return result;
    }

    private updateKeyboard(): void {
        // Steering Target: +1 for Left, -1 for Right (Convention: Left = +steer, Right = -steer)
        this.targetSteer = 0;
        if (this.keys['a'] || this.keys['A'] || this.keys['ArrowLeft'] || this.keys['KeyA'] || this.touchStates.left) {
            this.targetSteer += 1;
        }
        if (this.keys['d'] || this.keys['D'] || this.keys['ArrowRight'] || this.keys['KeyD'] || this.touchStates.right) {
            this.targetSteer -= 1;
        }

        // Throttle & Brake
        const isUp = this.keys['w'] || this.keys['W'] || this.keys['ArrowUp'] || this.keys['KeyW'] || this.touchStates.accel;
        const isDown = this.keys['s'] || this.keys['S'] || this.keys['ArrowDown'] || this.keys['KeyS'] || this.touchStates.brake;

        this.state.throttle = isUp ? 1 : 0;
        this.state.brake = isDown ? 1 : 0;
    }

    private updateGamepad(): void {
        const gamepads = navigator.getGamepads();
        const pad = gamepads[0];
        if (!pad) return;

        // Left Stick Steering (with deadzone) - Convention: Left = +steer, Right = -steer
        const stickX = pad.axes[0];
        if (Math.abs(stickX) > 0.12) {
            this.targetSteer = -stickX;
        }

        // Triggers (Analog)
        this.state.throttle = Math.max(this.state.throttle, pad.buttons[7]?.value || 0); // RT
        this.state.brake = Math.max(this.state.brake, pad.buttons[6]?.value || 0);    // LT

        // Buttons
        if (pad.buttons[0]?.pressed) this.state.cameraToggle = true; // A Button
        if (pad.buttons[9]?.pressed) this.state.pause = !this.state.pause; // Start Button
    }

    private applyAnalogSmoothing(delta: number): void {
        const lerpSpeed = 7.0;
        this.currentSteer = THREE.MathUtils.lerp(this.currentSteer, this.targetSteer, Math.min(1.0, lerpSpeed * delta));

        // Exponential curve for fine center control and responsive hard steering
        const exp = 1.3;
        this.state.steer = Math.sign(this.currentSteer) * Math.pow(Math.abs(this.currentSteer), exp);
    }
}
