import { rk4 } from '../rk4.js';

export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));

const TRAIL_MAX = 600;        // points (~10 s at the 60 Hz sample rate)
const HISTORY_SECONDS = 12.5; // graph window

// Common behaviour for every simulated system. Subclasses provide:
//   static typeName, static paramDefs
//   this.state / this.initialState  (generalised coordinates + velocities)
//   derivs(state, g), massPositions(), massVelocities(), energy(g),
//   coordinate(g), coordLabel(), dragTo(massIndex, worldPos), drawStructure(ctx, scale)
// All positions are in metres with y growing downward; the anchor is the
// fixed mounting point the system hangs from.
export class PhysicsObject {
  constructor(anchor) {
    this.anchor = { ...anchor };
    this.color = '#4fc3f7';
    this.name = this.constructor.typeName;
    this.showTrail = true;
    this.showVectors = false;
    this.dragging = false;
    this.trail = [];
    this.history = [];        // [time, coordinate] samples for the graph
    this.lastPeriod = null;
    this._prevCoord = null;
    this._lastCrossing = null;
    this._prevVels = null;
    this._accels = null;
    this._tick = 0;
    for (const def of this.constructor.paramDefs) this[def.key] = def.value;
  }

  step(dt, g, t) {
    if (this.dragging) {
      this._prevVels = null;
      this._accels = null;
    } else {
      this.state = rk4(this.state, s => this.derivs(s, g), dt);
      const vels = this.massVelocities();
      if (this._prevVels) {
        this._accels = vels.map((v, i) => ({
          x: (v.x - this._prevVels[i].x) / dt,
          y: (v.y - this._prevVels[i].y) / dt,
        }));
      }
      this._prevVels = vels;
    }

    // Period = time between successive upward zero crossings of the
    // primary coordinate.
    const c = this.coordinate(g);
    if (!this.dragging && this._prevCoord !== null && this._prevCoord < 0 && c >= 0) {
      if (this._lastCrossing !== null) this.lastPeriod = t - this._lastCrossing;
      this._lastCrossing = t;
    }
    this._prevCoord = c;

    if (++this._tick % 4 === 0) { // sample trail/graph at 60 Hz, not every physics step
      if (this.showTrail) {
        const p = this.massPositions()[this.tracedMass()];
        this.trail.push({ x: p.x, y: p.y });
        if (this.trail.length > TRAIL_MAX) this.trail.shift();
      }
      this.history.push([t, c]);
      while (this.history.length && t - this.history[0][0] > HISTORY_SECONDS) {
        this.history.shift();
      }
    }
  }

  reset() {
    this.state = [...this.initialState];
    this.dragging = false;
    this.trail = [];
    this.history = [];
    this.lastPeriod = null;
    this._prevCoord = null;
    this._lastCrossing = null;
    this._prevVels = null;
    this._accels = null;
    this._tick = 0;
  }

  // Which mass leaves the trail: the last (lowest) one by default.
  tracedMass() { return this.massPositions().length - 1; }
}
