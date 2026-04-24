import * as THREE from 'three';

export interface InputState {
    steer: number;
    throttle: number;
    brake: number;
    cameraToggle: boolean;
    pause: boolean;
}

/**
 * InputManager: Unified controller for Keyboard, Gamepad, and Analog Smoothing.
 */
export class InputManager {
    private state: InputState = {
        steer: 0,
        throttle: 0,
        brake: 0,
        cameraToggle: false,
        pause: false
    };

    private keys: Record<string, boolean> = {};
    private touchStates = { left: false, right: false, accel: false, brake: false };
    private targetSteer: number = 0;
    private currentSteer: number = 0;
    private isTouch: boolean;

    constructor() {
        this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key === 'Escape') this.state.pause = !this.state.pause;
            if (e.key.toLowerCase() === 'c') this.state.cameraToggle = true;
        });
        window.addEventListener('keyup', (e) => this.keys[e.key] = false);

        if (this.isTouch) {
            this.initTouch();
        }
    }

    private initTouch(): void {
        const bind = (id: string, key: keyof typeof this.touchStates) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('touchstart', (e) => { e.preventDefault(); this.touchStates[key] = true; });
            el.addEventListener('touchend', (e) => { e.preventDefault(); this.touchStates[key] = false; });
            el.addEventListener('touchcancel', (e) => { e.preventDefault(); this.touchStates[key] = false; });
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
        
        // Reset toggles after one frame
        const result = { ...this.state };
        this.state.cameraToggle = false;
        return result;
    }

    private updateKeyboard(): void {
        // Steering Target
        this.targetSteer = 0;
        if (this.keys['a'] || this.keys['ArrowLeft'] || this.touchStates.left) this.targetSteer -= 1;
        if (this.keys['d'] || this.keys['ArrowRight'] || this.touchStates.right) this.targetSteer += 1;

        // Throttle & Brake
        this.state.throttle = (this.keys['w'] || this.keys['ArrowUp'] || this.touchStates.accel) ? 1 : 0;
        this.state.brake = (this.keys['s'] || this.keys['ArrowDown'] || this.touchStates.brake) ? 1 : 0;
    }

    private updateGamepad(): void {
        const gamepads = navigator.getGamepads();
        const pad = gamepads[0];
        if (!pad) return;

        // Left Stick Steering (with deadzone)
        const stickX = pad.axes[0];
        if (Math.abs(stickX) > 0.1) {
            this.targetSteer = stickX;
        }

        // Triggers (Analog)
        this.state.throttle = Math.max(this.state.throttle, pad.buttons[7]?.value || 0); // RT
        this.state.brake = Math.max(this.state.brake, pad.buttons[6]?.value || 0);    // LT

        // Buttons
        if (pad.buttons[0]?.pressed) this.state.cameraToggle = true; // A Button
    }

    private applyAnalogSmoothing(delta: number): void {
        // Steering Lerp
        const lerpSpeed = 5.0;
        this.currentSteer = THREE.MathUtils.lerp(this.currentSteer, this.targetSteer, lerpSpeed * delta);

        // Exponential Curve: Gentle near center, sharp at edges
        const exp = 1.5;
        this.state.steer = Math.sign(this.currentSteer) * Math.pow(Math.abs(this.currentSteer), exp);
    }
}
