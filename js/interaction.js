import { SCALE, massRadiusPx } from './renderer.js';

// Pointer handling: drag masses to set positions (released from rest),
// drag anchor brackets to move whole systems, click empty space to deselect.
export function attachInteraction(canvas, scene) {
  let drag = null; // { obj, massIndex } or { obj, anchor: true }

  const toWorld = e => {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / SCALE, y: (e.clientY - r.top) / SCALE };
  };

  canvas.addEventListener('pointerdown', e => {
    const p = toWorld(e);

    // Masses first (topmost drawn wins), then anchors.
    for (let oi = scene.objects.length - 1; oi >= 0; oi--) {
      const o = scene.objects[oi];
      const ps = o.massPositions();
      for (let mi = ps.length - 1; mi >= 0; mi--) {
        const r = massRadiusPx(ps[mi].m) / SCALE + 0.06;
        if (Math.hypot(p.x - ps[mi].x, p.y - ps[mi].y) < r) {
          scene.select(o);
          o.dragging = true;
          o.dragTo(mi, p);
          drag = { obj: o, massIndex: mi };
          canvas.setPointerCapture(e.pointerId);
          return;
        }
      }
    }
    for (let oi = scene.objects.length - 1; oi >= 0; oi--) {
      const o = scene.objects[oi];
      if (Math.hypot(p.x - o.anchor.x, p.y - o.anchor.y) < 0.18) {
        scene.select(o);
        drag = { obj: o, anchor: true };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }
    scene.select(null);
  });

  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = toWorld(e);
    if (drag.anchor) {
      const wM = canvas.clientWidth / SCALE;
      const hM = canvas.clientHeight / SCALE;
      drag.obj.anchor.x = Math.min(wM - 0.2, Math.max(0.2, p.x));
      drag.obj.anchor.y = Math.min(hM - 0.2, Math.max(0.2, p.y));
    } else {
      drag.obj.dragTo(drag.massIndex, p);
    }
  });

  const release = () => {
    if (drag && !drag.anchor) drag.obj.dragging = false;
    drag = null;
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
}
