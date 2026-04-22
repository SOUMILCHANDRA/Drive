import * as THREE from 'three';

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 150;
    this.canvas.height = 150;
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '2rem';
    this.canvas.style.right = '2rem';
    this.canvas.style.borderRadius = '50%';
    this.canvas.style.background = 'rgba(0,0,0,0.7)';
    this.canvas.style.border = '2px solid #00f3ff';
    this.canvas.style.zIndex = '100';
    this.canvas.style.backdropFilter = 'blur(10px)';
    
    this.ctx = this.canvas.getContext('2d')!;
    document.getElementById('app')?.appendChild(this.canvas);
  }

  public update(carPos: THREE.Vector3, carAngle: number, points: THREE.Vector3[]) {
    this.ctx.clearRect(0, 0, 150, 150);
    
    this.ctx.save();
    this.ctx.translate(75, 75);
    this.ctx.rotate(carAngle);

    // Draw track
    this.ctx.strokeStyle = '#ff00ff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    
    for (const p of points) {
        const dx = (p.x - carPos.x) * 0.5;
        const dz = (p.z - carPos.z) * 0.5;
        if (dz > -100 && dz < 100) {
            this.ctx.lineTo(dx, -dz);
        }
    }
    this.ctx.stroke();

    // Draw car
    this.ctx.fillStyle = '#fff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
  }
}
