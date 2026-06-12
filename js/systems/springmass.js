import { PhysicsObject } from './base.js';

// Mass hanging from a vertical spring (Hooke's law).
// State: [spring length s (m), stretch speed (m/s)].
export class SpringMass extends PhysicsObject {
  static typeName = 'Spring';
  static paramDefs = [
    { key: 'k',       label: 'Spring constant', unit: 'N/m',  min: 2,   max: 200, step: 1,    value: 40 },
    { key: 'mass',    label: 'Mass',            unit: 'kg',   min: 0.1, max: 10,  step: 0.1,  value: 1.5 },
    { key: 'restLen', label: 'Rest length',     unit: 'm',    min: 0.3, max: 2,   step: 0.01, value: 1.0 },
    { key: 'damping', label: 'Damping',         unit: 'kg/s', min: 0,   max: 5,   step: 0.05, value: 0 },
  ];

  constructor(anchor, g = 9.81) {
    super(anchor);
    this.state = [this.equilibrium(g) + 0.45, 0];
    this.initialState = [...this.state];
  }

  equilibrium(g) { return this.restLen + (this.mass * g) / this.k; }

  derivs([s, v], g) {
    return [v, g - (this.k / this.mass) * (s - this.restLen) - (this.damping / this.mass) * v];
  }

  massPositions() {
    return [{ x: this.anchor.x, y: this.anchor.y + this.state[0], m: this.mass }];
  }

  massVelocities() {
    return [{ x: 0, y: this.state[1] }];
  }

  energy(g) {
    const [s, v] = this.state;
    // Elastic + gravitational PE, referenced to zero at the equilibrium length.
    const pe = at => 0.5 * this.k * (at - this.restLen) ** 2 - this.mass * g * at;
    return { ke: 0.5 * this.mass * v * v, pe: pe(s) - pe(this.equilibrium(g)) };
  }

  coordinate(g) { return this.state[0] - this.equilibrium(g); }
  coordLabel() { return 'displacement (m)'; }

  dragTo(i, p) {
    this.state = [Math.min(8, Math.max(0.15, p.y - this.anchor.y)), 0];
  }

  drawStructure(ctx, S) {
    const ax = this.anchor.x * S;
    const ay = this.anchor.y * S;
    const my = (this.anchor.y + this.state[0]) * S;
    const coils = 12;
    const amp = 9;
    const top = ay + 8;
    const bottom = my - 8;
    ctx.strokeStyle = '#9aa7b5';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax, top);
    for (let i = 1; i < coils; i++) {
      ctx.lineTo(ax + (i % 2 ? amp : -amp), top + ((bottom - top) * i) / coils);
    }
    ctx.lineTo(ax, bottom);
    ctx.lineTo(ax, my);
    ctx.stroke();
  }
}
