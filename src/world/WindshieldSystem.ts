/**
 * WindshieldSystem: Renders a gentle, cinematic windshield rain streak overlay
 * directly to a 2D canvas overlay without any WebGL draw call overhead.
 */
export class WindshieldSystem {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private streaks: Array<{ x: number; y: number; len: number; speed: number; alpha: number }> = [];
    private width: number = window.innerWidth;
    private height: number = window.innerHeight;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d')!;
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Initialize 60 subtle windshield rain streaks
        for (let i = 0; i < 60; i++) {
            this.streaks.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                len: 12 + Math.random() * 24,
                speed: 120 + Math.random() * 180,
                alpha: 0.08 + Math.random() * 0.14
            });
        }
    }

    private resize(): void {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    }

    public update(delta: number, carSpeed: number, rainIntensity: number = 0.5): void {
        if (rainIntensity <= 0.02) {
            this.ctx.clearRect(0, 0, this.width, this.height);
            return;
        }

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        // Speed-dependent flow factor: driving faster pulls water streaks back and down
        const speedNorm = Math.min(carSpeed * 3.6 / 150, 1.2);
        const flowY = 1.0 + speedNorm * 1.8;
        const streakLenMult = 1.0 + speedNorm * 1.5;

        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';

        for (const s of this.streaks) {
            // Slight lateral deflection toward edges from air pressure
            const centerX = this.width * 0.5;
            const lateralLean = (s.x - centerX) / this.width * 15 * speedNorm;

            s.y += s.speed * flowY * delta;
            s.x += lateralLean * delta * 40;

            if (s.y > this.height + 40 || s.x < -20 || s.x > this.width + 20) {
                s.y = -30 - Math.random() * 40;
                s.x = Math.random() * this.width;
                s.len = 12 + Math.random() * 24;
            }

            const currentLen = s.len * streakLenMult;
            const currentAlpha = s.alpha * Math.min(1.0, rainIntensity * 1.5);

            ctx.strokeStyle = `rgba(180, 215, 255, ${currentAlpha.toFixed(3)})`;
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            // Angled streak down with aerodynamic curve
            ctx.lineTo(s.x + lateralLean * 0.6, s.y + currentLen);
            ctx.stroke();

            // Tiny droplet head
            ctx.fillStyle = `rgba(220, 240, 255, ${(currentAlpha * 1.5).toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(s.x + lateralLean * 0.6, s.y + currentLen, 1.0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
