const PALETTE = ['#4fc3f7', '#ffb74d', '#aed581', '#f06292', '#ba68c8', '#fff176', '#4dd0e1', '#ff8a65'];

// Holds the collection of physics objects, the global settings, and the
// current selection. UI modules subscribe via the onSelectionChange /
// onObjectsChange callbacks.
export class Scene {
  constructor() {
    this.objects = [];
    this.gravity = 9.81;
    this.time = 0;
    this.selected = null;
    this.onSelectionChange = null;
    this.onObjectsChange = null;
    this._counts = {};
    this._colorIdx = 0;
  }

  add(Type, widthM) {
    const obj = new Type(this.nextAnchor(widthM), this.gravity);
    obj.color = PALETTE[this._colorIdx++ % PALETTE.length];
    const n = (this._counts[Type.typeName] = (this._counts[Type.typeName] || 0) + 1);
    obj.name = `${Type.typeName} ${n}`;
    this.objects.push(obj);
    this.onObjectsChange?.();
    this.select(obj);
    return obj;
  }

  // First free slot along the ceiling line so new objects never overlap.
  nextAnchor(widthM = 12) {
    const y = 0.6;
    const usable = Math.max(2.5, widthM - 2);
    for (let i = 0; i < 50; i++) {
      const x = 1.0 + (i * 1.9) % usable;
      if (!this.objects.some(o => Math.hypot(o.anchor.x - x, o.anchor.y - y) < 0.9)) {
        return { x, y };
      }
    }
    return { x: 1.0 + Math.random() * usable, y };
  }

  remove(obj) {
    this.objects = this.objects.filter(o => o !== obj);
    this.onObjectsChange?.();
    if (this.selected === obj) this.select(null);
  }

  select(obj) {
    if (this.selected === obj) return;
    this.selected = obj;
    this.onSelectionChange?.();
  }

  step(dt) {
    this.time += dt;
    for (const o of this.objects) o.step(dt, this.gravity, this.time);
  }

  resetAll() {
    this.time = 0;
    for (const o of this.objects) o.reset();
  }
}
