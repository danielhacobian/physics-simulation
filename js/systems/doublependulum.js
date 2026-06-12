import { PhysicsObject, wrapAngle } from './base.js';

// Double pendulum: two point masses on rigid massless links, fully nonlinear.
// State: [θ1, ω1, θ2, ω2], angles measured from vertical.
export class DoublePendulum extends PhysicsObject {
  static typeName = 'Double pendulum';
  static paramDefs = [
    { key: 'l1',      label: 'Upper length', unit: 'm',  min: 0.2, max: 2,  step: 0.01, value: 1.0 },
    { key: 'l2',      label: 'Lower length', unit: 'm',  min: 0.2, max: 2,  step: 0.01, value: 1.0 },
    { key: 'm1',      label: 'Upper mass',   unit: 'kg', min: 0.1, max: 10, step: 0.1,  value: 1.5 },
    { key: 'm2',      label: 'Lower mass',   unit: 'kg', min: 0.1, max: 10, step: 0.1,  value: 1.5 },
    { key: 'damping', label: 'Damping',      unit: '/s', min: 0,   max: 2,  step: 0.01, value: 0 },
  ];

  constructor(anchor) {
    super(anchor);
    this.state = [Math.PI / 2, 0, Math.PI / 2 + 0.6, 0];
    this.initialState = [...this.state];
  }

  derivs([t1, w1, t2, w2], g) {
    const { l1, l2, m1, m2, damping: d } = this;
    const D = t1 - t2;
    const den = 2 * m1 + m2 - m2 * Math.cos(2 * D);
    const a1 =
      (-g * (2 * m1 + m2) * Math.sin(t1) -
        m2 * g * Math.sin(t1 - 2 * t2) -
        2 * Math.sin(D) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(D))) /
        (l1 * den) -
      d * w1;
    const a2 =
      (2 * Math.sin(D) *
        (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * Math.cos(D))) /
        (l2 * den) -
      d * w2;
    return [w1, a1, w2, a2];
  }

  massPositions() {
    const [t1, , t2] = this.state;
    const p1 = {
      x: this.anchor.x + this.l1 * Math.sin(t1),
      y: this.anchor.y + this.l1 * Math.cos(t1),
      m: this.m1,
    };
    return [
      p1,
      { x: p1.x + this.l2 * Math.sin(t2), y: p1.y + this.l2 * Math.cos(t2), m: this.m2 },
    ];
  }

  massVelocities() {
    const [t1, w1, t2, w2] = this.state;
    const v1 = { x: this.l1 * w1 * Math.cos(t1), y: -this.l1 * w1 * Math.sin(t1) };
    return [
      v1,
      { x: v1.x + this.l2 * w2 * Math.cos(t2), y: v1.y - this.l2 * w2 * Math.sin(t2) },
    ];
  }

  energy(g) {
    const [v1, v2] = this.massVelocities();
    const [t1, , t2] = this.state;
    const ke =
      0.5 * this.m1 * (v1.x ** 2 + v1.y ** 2) + 0.5 * this.m2 * (v2.x ** 2 + v2.y ** 2);
    const pe =
      this.m1 * g * this.l1 * (1 - Math.cos(t1)) +
      this.m2 * g * (this.l1 * (1 - Math.cos(t1)) + this.l2 * (1 - Math.cos(t2)));
    return { ke, pe };
  }

  coordinate() { return wrapAngle(this.state[0]); }
  coordLabel() { return 'upper angle θ₁ (rad)'; }

  dragTo(i, p) {
    const [t1, , t2] = this.state;
    if (i === 0) {
      this.state = [Math.atan2(p.x - this.anchor.x, p.y - this.anchor.y), 0, t2, 0];
    } else {
      const jx = this.anchor.x + this.l1 * Math.sin(t1);
      const jy = this.anchor.y + this.l1 * Math.cos(t1);
      this.state = [t1, 0, Math.atan2(p.x - jx, p.y - jy), 0];
    }
  }

  drawStructure(ctx, S) {
    const [p1, p2] = this.massPositions();
    ctx.strokeStyle = '#9aa7b5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(this.anchor.x * S, this.anchor.y * S);
    ctx.lineTo(p1.x * S, p1.y * S);
    ctx.lineTo(p2.x * S, p2.y * S);
    ctx.stroke();
  }
}
