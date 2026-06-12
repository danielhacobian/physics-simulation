export const SCALE = 100; // pixels per metre

export const massRadiusPx = m => 9 + 6 * Math.cbrt(m);

const VEL_COLOR = '#7ee787';
const FORCE_COLOR = '#ffa657';
const VEL_PX_PER_MS = 22;   // arrow pixels per m/s
const FORCE_PX_PER_N = 1.6; // arrow pixels per newton
const ARROW_CAP_PX = 140;

export class Renderer {
  constructor(canvas, scene) {
    this.canvas = canvas;
    this.scene = scene;
    this.ctx = canvas.getContext('2d');
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, this.canvas.clientWidth * dpr);
    this.canvas.height = Math.max(1, this.canvas.clientHeight * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  get widthM() { return this.canvas.clientWidth / SCALE; }
  get heightM() { return this.canvas.clientHeight / SCALE; }

  draw() {
    const { ctx, scene } = this;
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, W, H);
    this.drawGrid(W, H);

    for (const o of scene.objects) this.drawTrail(o);
    for (const o of scene.objects) this.drawObject(o);
  }

  drawGrid(W, H) {
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += SCALE) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = 0; y <= H; y += SCALE) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  drawTrail(o) {
    if (!o.showTrail || o.trail.length < 2) return;
    const { ctx } = this;
    const n = o.trail.length;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = o.color;
    for (let i = 1; i < n; i++) {
      ctx.globalAlpha = (0.55 * i) / n;
      ctx.beginPath();
      ctx.moveTo(o.trail[i - 1].x * SCALE, o.trail[i - 1].y * SCALE);
      ctx.lineTo(o.trail[i].x * SCALE, o.trail[i].y * SCALE);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  drawObject(o) {
    const { ctx } = this;
    const selected = o === this.scene.selected;

    o.drawStructure(ctx, SCALE);

    // Anchor bracket.
    const ax = o.anchor.x * SCALE;
    const ay = o.anchor.y * SCALE;
    ctx.fillStyle = 'rgba(91, 104, 120, 0.35)';
    ctx.fillRect(ax - 16, ay - 8, 32, 4);
    ctx.fillStyle = selected ? '#7fd4ff' : '#5b6878';
    ctx.fillRect(ax - 12, ay - 4, 24, 8);

    // Masses.
    const ps = o.massPositions();
    for (const p of ps) {
      const px = p.x * SCALE;
      const py = p.y * SCALE;
      const r = massRadiusPx(p.m);
      if (selected) {
        ctx.beginPath();
        ctx.arc(px, py, r + 5, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(79, 195, 247, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = o.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (o.showVectors) {
      const vels = o.massVelocities();
      ps.forEach((p, i) => {
        const px = p.x * SCALE;
        const py = p.y * SCALE;
        this.drawArrow(px, py, vels[i].x * VEL_PX_PER_MS, vels[i].y * VEL_PX_PER_MS, VEL_COLOR);
        if (o._accels) {
          const f = { x: p.m * o._accels[i].x, y: p.m * o._accels[i].y };
          this.drawArrow(px, py, f.x * FORCE_PX_PER_N, f.y * FORCE_PX_PER_N, FORCE_COLOR);
        }
      });
    }
  }

  drawArrow(x0, y0, dx, dy, color) {
    const len = Math.hypot(dx, dy);
    if (len < 6) return;
    if (len > ARROW_CAP_PX) {
      dx *= ARROW_CAP_PX / len;
      dy *= ARROW_CAP_PX / len;
    }
    const { ctx } = this;
    const x1 = x0 + dx;
    const y1 = y0 + dy;
    const ang = Math.atan2(dy, dx);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - 8 * Math.cos(ang - 0.4), y1 - 8 * Math.sin(ang - 0.4));
    ctx.lineTo(x1 - 8 * Math.cos(ang + 0.4), y1 - 8 * Math.sin(ang + 0.4));
    ctx.closePath();
    ctx.fill();
  }
}
