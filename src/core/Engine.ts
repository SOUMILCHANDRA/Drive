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
    const loop = () => {
      requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      
      // Execute all system updates
      this.updateCallbacks.forEach(cb => cb(delta));
    };
    loop();
  }
}
