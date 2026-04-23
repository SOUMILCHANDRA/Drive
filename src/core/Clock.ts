import * as THREE from 'three';

/**
 * Clock: Manages Delta Time for consistent game logic.
 */
export class Clock {
  private clock: THREE.Clock;

  constructor() {
    this.clock = new THREE.Clock();
  }

  public getDelta(): number {
    return this.clock.getDelta();
  }

  public getElapsedTime(): number {
    return this.clock.getElapsedTime();
  }
}
