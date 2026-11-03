import { Clock } from './Clock';

/**
 * Engine: The main Game Loop orchestrator.
 */
export class Engine {
  private clock: Clock;
  private updateCallbacks: ((delta: number) => void)[] = [];

  constructor() {
    this.clock = new Clock();
  }

  public onUpdate(callback: (delta: number) => void): void {
    this.updateCallbacks.push(callback);
  }

  public start(): void {
    let frame = 0;
    const loop = () => {
      requestAnimationFrame(loop);
      try {
        const delta = Math.min(this.clock.getDelta(), 0.1);
        frame++;
        (window as any).__ENGINE_FRAME__ = frame;
        // Execute all system updates
        this.updateCallbacks.forEach(cb => cb(delta));
      } catch (err) {
        console.error('[ENGINE CRITICAL ERROR]', err);
      }
    };
    loop();
  }
}
