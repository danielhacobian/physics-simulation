import { PhysicsObject, wrapAngle } from './base.js';
import { RodLink, SpringLink } from './links.js';

// Solve A x = b for a small dense system (Gaussian elimination, partial pivoting).
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const p = M[col][col] || 1e-12;
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / p;
      if (!f) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let c = r + 1; c < n; c++) s -= M[r][c] * x[c];
    x[r] = s / (M[r][r] || 1e-12);
  }
  return x;
}

// A tree of rod/spring links rooted at the anchor. Mass k sits at the end of
// link k; link k hangs from the mass of parents[k] (-1 = the anchor). Links
// are stored parents-before-children (we only ever append).
//
// Generalised coordinates q: per link, the angle from vertical; spring links
// additionally their current length. State layout: [q..., q̇...].
//
// Dynamics via d'Alembert: M(q) q̈ = Q - Σₖ mₖ Jₖᵀ (J̇ₖ q̇), where
// pₖ = p_parent + r u(θ), u = (sinθ, cosθ). Every Jacobian column is the same
// 2-vector for all descendants of the owning link, which reduces M and the
// bias terms to subtree-mass sums — exact equations, no constraint drift.
export class Assembly extends PhysicsObject {
  static typeName = 'Assembly';
  static paramDefs = [];

  constructor(anchor, g = 9.81) {
    super(anchor);
    this.links = [];
    this.parents = [];
    this.state = [];
    this.initialState = [];
    this._g0 = g; // gravity at creation, for initial spring lengths
  }

  get ndof() {
    return this.links.reduce((s, l) => s + l.constructor.dofCount, 0);
  }

  dofOffsets() {
    let o = 0;
    return this.links.map(l => { const x = o; o += l.constructor.dofCount; return x; });
  }

  // Total mass hanging at-or-below each link (children come after parents,
  // so one reverse pass accumulates the subtree sums).
  subtreeMasses() {
    const msub = this.links.map(l => l.mass);
    for (let k = this.links.length - 1; k >= 0; k--) {
      const p = this.parents[k];
      if (p >= 0) msub[p] += msub[k];
    }
    return msub;
  }

  isAncestor(i, j) {
    for (let x = j; x >= 0; x = this.parents[x]) if (x === i) return true;
    return false;
  }

  // Links in depth-first order with depth, for tree-shaped UI rendering.
  linkTreeOrder() {
    const children = this.links.map(() => []);
    const roots = [];
    this.parents.forEach((p, i) => (p < 0 ? roots : children[p]).push(i));
    const out = [];
    const visit = (i, depth) => {
      out.push({ i, depth });
      for (const c of children[i]) visit(c, depth + 1);
    };
    roots.forEach(r => visit(r, 0));
    return out;
  }

  appendLink(LinkClass, parentIndex, overrides = {}, initial = {}) {
    const oldN = this.ndof;
    const q = this.state.slice(0, oldN);
    const qd = this.state.slice(oldN);
    const link = new LinkClass(overrides);
    this.links.push(link);
    this.parents.push(parentIndex ?? this.links.length - 2);
    const theta = initial.theta ?? 0;
    if (link instanceof SpringLink) {
      const s = initial.s ?? link.restLen + (link.mass * this._g0) / link.k;
      this.state = [...q, theta, s, ...qd, 0, 0];
    } else {
      this.state = [...q, theta, ...qd, 0];
    }
    this.afterStructureChange();
    return link;
  }

  // Removes a link and everything hanging from it. The root cannot be
  // removed (delete the whole object instead).
  removeLink(idx) {
    if (this.parents[idx] < 0) return;
    const doomed = new Set([idx]);
    for (let i = 0; i < this.links.length; i++) {
      if (doomed.has(this.parents[i])) doomed.add(i);
    }
    const offs = this.dofOffsets();
    const n = this.ndof;
    const keepQ = [];
    const keepQd = [];
    this.links.forEach((l, i) => {
      if (doomed.has(i)) return;
      for (let d = 0; d < l.constructor.dofCount; d++) {
        keepQ.push(this.state[offs[i] + d]);
        keepQd.push(this.state[n + offs[i] + d]);
      }
    });
    const map = [];
    let ni = 0;
    for (let i = 0; i < this.links.length; i++) map[i] = doomed.has(i) ? -1 : ni++;
    this.links = this.links.filter((_, i) => !doomed.has(i));
    this.parents = this.parents.filter((_, i) => !doomed.has(i)).map(p => (p < 0 ? -1 : map[p]));
    this.state = [...keepQ, ...keepQd];
    this.afterStructureChange();
  }

  afterStructureChange() {
    this.initialState = [...this.state];
    this.reset();
  }

  derivs(state, g) {
    const links = this.links;
    const L = links.length;
    const n = this.ndof;
    const offs = this.dofOffsets();
    const q = state.slice(0, n);
    const qd = state.slice(n);

    // Per-link geometry and rates.
    const sin = [], cos = [], r = [], rdot = [], thdot = [];
    for (let i = 0; i < L; i++) {
      const th = q[offs[i]];
      sin[i] = Math.sin(th);
      cos[i] = Math.cos(th);
      thdot[i] = qd[offs[i]];
      if (links[i] instanceof SpringLink) {
        r[i] = q[offs[i] + 1];
        rdot[i] = qd[offs[i] + 1];
      } else {
        r[i] = links[i].length;
        rdot[i] = 0;
      }
    }

    // Per-DOF Jacobian column c and its time derivative ċ (same vector for
    // every descendant mass), plus the owning link of each DOF.
    const cx = [], cy = [], cdx = [], cdy = [], owner = [];
    for (let i = 0; i < L; i++) {
      let d = offs[i];
      cx[d] = r[i] * cos[i];
      cy[d] = -r[i] * sin[i];
      cdx[d] = rdot[i] * cos[i] - r[i] * thdot[i] * sin[i];
      cdy[d] = -rdot[i] * sin[i] - r[i] * thdot[i] * cos[i];
      owner[d] = i;
      if (links[i] instanceof SpringLink) {
        d++;
        cx[d] = sin[i];
        cy[d] = cos[i];
        cdx[d] = thdot[i] * cos[i];
        cdy[d] = -thdot[i] * sin[i];
        owner[d] = i;
      }
    }

    // Aₖ = J̇ₖ q̇, built top-down along the tree.
    const Ax = [], Ay = [];
    for (let k = 0; k < L; k++) {
      const p = this.parents[k];
      let ax = p < 0 ? 0 : Ax[p];
      let ay = p < 0 ? 0 : Ay[p];
      for (let d = offs[k]; d < offs[k] + links[k].constructor.dofCount; d++) {
        ax += cdx[d] * qd[d];
        ay += cdy[d] * qd[d];
      }
      Ax[k] = ax;
      Ay[k] = ay;
    }

    // Subtree sums of mass and of mₖAₖ (bias forces), bottom-up.
    const msub = links.map(l => l.mass);
    const Bx = links.map((l, k) => l.mass * Ax[k]);
    const By = links.map((l, k) => l.mass * Ay[k]);
    for (let k = L - 1; k >= 0; k--) {
      const p = this.parents[k];
      if (p >= 0) {
        msub[p] += msub[k];
        Bx[p] += Bx[k];
        By[p] += By[k];
      }
    }

    // Mass matrix: M[d][e] = (c_d·c_e) · (mass of the common subtree); zero
    // for DOFs in disjoint subtrees.
    const M = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let d = 0; d < n; d++) {
      for (let e = d; e < n; e++) {
        const i = owner[d], j = owner[e];
        let mt = 0;
        if (this.isAncestor(i, j)) mt = msub[j];
        else if (this.isAncestor(j, i)) mt = msub[i];
        if (!mt) continue;
        const v = (cx[d] * cx[e] + cy[d] * cy[e]) * mt;
        M[d][e] = v;
        M[e][d] = v;
      }
    }

    // Generalised forces: gravity minus bias, plus spring restoring force.
    const rhs = new Array(n);
    for (let d = 0; d < n; d++) {
      const i = owner[d];
      rhs[d] = cy[d] * g * msub[i] - (cx[d] * Bx[i] + cy[d] * By[i]);
    }
    for (let i = 0; i < L; i++) {
      if (links[i] instanceof SpringLink) {
        const d = offs[i] + 1;
        rhs[d] -= links[i].k * (q[d] - links[i].restLen);
      }
    }

    const qdd = solveLinear(M, rhs);
    for (let d = 0; d < n; d++) qdd[d] -= links[owner[d]].damping * qd[d];
    return [...qd, ...qdd];
  }

  massPositions() {
    const offs = this.dofOffsets();
    const out = [];
    this.links.forEach((l, i) => {
      const p = this.parents[i] < 0 ? this.anchor : out[this.parents[i]];
      const th = this.state[offs[i]];
      const r = l instanceof SpringLink ? this.state[offs[i] + 1] : l.length;
      out.push({ x: p.x + r * Math.sin(th), y: p.y + r * Math.cos(th), m: l.mass });
    });
    return out;
  }

  massVelocities() {
    const n = this.ndof;
    const offs = this.dofOffsets();
    const out = [];
    this.links.forEach((l, i) => {
      const pv = this.parents[i] < 0 ? { x: 0, y: 0 } : out[this.parents[i]];
      const th = this.state[offs[i]];
      const w = this.state[n + offs[i]];
      const spring = l instanceof SpringLink;
      const r = spring ? this.state[offs[i] + 1] : l.length;
      const rd = spring ? this.state[n + offs[i] + 1] : 0;
      out.push({
        x: pv.x + rd * Math.sin(th) + r * w * Math.cos(th),
        y: pv.y + rd * Math.cos(th) - r * w * Math.sin(th),
      });
    });
    return out;
  }

  energy(g) {
    const offs = this.dofOffsets();
    const ps = this.massPositions();
    const vels = this.massVelocities();
    let ke = 0;
    let pe = 0;
    this.links.forEach((l, i) => {
      ke += 0.5 * l.mass * (vels[i].x ** 2 + vels[i].y ** 2);
      pe -= l.mass * g * (ps[i].y - this.anchor.y);
      if (l instanceof SpringLink) {
        pe += 0.5 * l.k * (this.state[offs[i] + 1] - l.restLen) ** 2;
      }
    });
    // Reference: everything hanging straight down at rest, springs stretched
    // by the weight of their subtree, so the rest state reads 0 J.
    const msub = this.subtreeMasses();
    const yref = [];
    let peRef = 0;
    this.links.forEach((l, i) => {
      const spring = l instanceof SpringLink;
      const rstar = spring ? l.restLen + (g * msub[i]) / l.k : l.length;
      const y = (this.parents[i] < 0 ? 0 : yref[this.parents[i]]) + rstar;
      yref.push(y);
      peRef -= l.mass * g * y;
      if (spring) peRef += 0.5 * l.k * (rstar - l.restLen) ** 2;
    });
    return { ke, pe: pe - peRef };
  }

  coordinate(g) {
    if (this.links.length === 1 && this.links[0] instanceof SpringLink) {
      const l = this.links[0];
      return this.state[1] - (l.restLen + (l.mass * g) / l.k);
    }
    return wrapAngle(this.state[0]);
  }

  coordLabel() {
    return this.links.length === 1 && this.links[0] instanceof SpringLink
      ? 'displacement (m)'
      : 'angle θ₁ (rad)';
  }

  // Dragging mass i re-aims link i from its parent's (frozen) position;
  // descendants keep their world angles. All velocities are zeroed so the
  // assembly is released from rest.
  dragTo(i, p) {
    const offs = this.dofOffsets();
    const ps = this.massPositions();
    const par = this.parents[i] < 0 ? this.anchor : ps[this.parents[i]];
    const dx = p.x - par.x;
    const dy = p.y - par.y;
    const q = this.state.slice(0, this.ndof);
    q[offs[i]] = Math.atan2(dx, dy);
    if (this.links[i] instanceof SpringLink) {
      q[offs[i] + 1] = Math.min(8, Math.max(0.15, Math.hypot(dx, dy)));
    }
    this.state = [...q, ...new Array(this.ndof).fill(0)];
  }

  // Trails follow every leaf mass.
  tracedMasses() {
    const hasChild = new Array(this.links.length).fill(false);
    this.parents.forEach(p => { if (p >= 0) hasChild[p] = true; });
    return this.links.map((_, i) => i).filter(i => !hasChild[i]);
  }

  drawStructure(ctx, S) {
    const ps = this.massPositions();
    ctx.strokeStyle = '#9aa7b5';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    this.links.forEach((l, i) => {
      const a = this.parents[i] < 0 ? this.anchor : ps[this.parents[i]];
      const b = ps[i];
      ctx.beginPath();
      if (l instanceof SpringLink) {
        zigzag(ctx, a.x * S, a.y * S, b.x * S, b.y * S);
      } else {
        ctx.moveTo(a.x * S, a.y * S);
        ctx.lineTo(b.x * S, b.y * S);
      }
      ctx.stroke();
    });
  }
}

function zigzag(ctx, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const ex = dx / len, ey = dy / len;
  const nx = -ey, ny = ex;
  const coils = 12;
  const amp = 9;
  const lead = Math.min(10, len * 0.1);
  ctx.moveTo(x0, y0);
  ctx.lineTo(x0 + ex * lead, y0 + ey * lead);
  for (let i = 1; i < coils; i++) {
    const t = lead + ((len - 2 * lead) * i) / coils;
    const off = i % 2 ? amp : -amp;
    ctx.lineTo(x0 + ex * t + nx * off, y0 + ey * t + ny * off);
  }
  ctx.lineTo(x1 - ex * lead, y1 - ey * lead);
  ctx.lineTo(x1, y1);
}

export { RodLink, SpringLink };
