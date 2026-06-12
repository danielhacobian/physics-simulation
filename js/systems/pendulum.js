import { PhysicsObject, wrapAngle } from './base.js';

// Simple pendulum: point mass on a rigid massless wire.
// State: [angle from vertical (rad), angular velocity (rad/s)].
export class Pendulum extends PhysicsObject {
  static typeName = 'Pendulum';
  static paramDefs = [
    { key: 'length',  label: 'Wire length', unit: 'm',  min: 0.3, max: 3.5, step: 0.01, value: 1.6 },
    { key: 'mass',    label: 'Bob mass',    unit: 'kg', min: 0.1, max: 10,  step: 0.1,  value: 1.5 },
    { key: 'damping', label: 'Damping',     unit: '/s', min: 0,   max: 2,   step: 0.01, value: 0 },
  ];

  constructor(anchor) {
    super(anchor);
    this.state = [0.7, 0];
    this.initialState = [...this.state];
  }

  derivs([th, w], g) {
    return [w, -(g / this.length) * Math.sin(th) - this.damping * w];
  }

  massPositions() {
    const [th] = this.state;
    return [{
      x: this.anchor.x + this.length * Math.sin(th),
      y: this.anchor.y + this.length * Math.cos(th),
      m: this.mass,
    }];
  }

  massVelocities() {
    const [th, w] = this.state;
    return [{ x: this.length * w * Math.cos(th), y: -this.length * w * Math.sin(th) }];
  }

  energy(g) {
    const [th, w] = this.state;
    return {
      ke: 0.5 * this.mass * (this.length * w) ** 2,
      pe: this.mass * g * this.length * (1 - Math.cos(th)),
    };
  }

  coordinate() { return wrapAngle(this.state[0]); }
  coordLabel() { return 'angle θ (rad)'; }

  dragTo(i, p) {
    this.state = [Math.atan2(p.x - this.anchor.x, p.y - this.anchor.y), 0];
  }

  drawStructure(ctx, S) {
    const [p] = this.massPositions();
    ctx.strokeStyle = '#9aa7b5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.anchor.x * S, this.anchor.y * S);
    ctx.lineTo(p.x * S, p.y * S);
    ctx.stroke();
  }
}
