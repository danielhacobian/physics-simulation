import { RodLink, SpringLink } from './systems/links.js';

const $ = id => document.getElementById(id);

const fmtDecimals = step => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);

// Sidebar + transport bar. The inspector renders one section per link of the
// selected assembly (indented by tree depth), building sliders generically
// from each link type's paramDefs, with buttons to grow or prune the tree.
export class UI {
  constructor(scene, engine, renderer, types) {
    this.scene = scene;
    this.engine = engine;
    this.graph = $('graph');
    this.graphCtx = this.graph.getContext('2d');

    $('add-pendulum').onclick = () => scene.add(types.Pendulum, renderer.widthM);
    $('add-spring').onclick = () => scene.add(types.SpringMass, renderer.widthM);
    $('add-double').onclick = () => scene.add(types.DoublePendulum, renderer.widthM);

    $('gravity').oninput = e => {
      scene.gravity = +e.target.value;
      $('gravity-val').textContent = `${scene.gravity.toFixed(2)} m/s²`;
    };
    $('speed').oninput = e => {
      engine.timeScale = +e.target.value;
      $('speed-val').textContent = `${engine.timeScale.toFixed(2)}×`;
    };

    $('btn-play').onclick = () => this.togglePlay();
    $('btn-reset').onclick = () => scene.resetAll();
    $('insp-delete').onclick = () => { if (scene.selected) scene.remove(scene.selected); };
    $('insp-trail').onchange = e => {
      const o = scene.selected;
      if (!o) return;
      o.showTrail = e.target.checked;
      if (!o.showTrail) o.trails.clear();
    };
    $('insp-vectors').onchange = e => {
      if (scene.selected) scene.selected.showVectors = e.target.checked;
    };

    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !/INPUT|BUTTON|SELECT/.test(e.target.tagName)) {
        e.preventDefault();
        this.togglePlay();
      }
    });

    scene.onSelectionChange = () => { this.buildInspector(); this.buildList(); };
    scene.onObjectsChange = () => this.buildList();
    this.buildList();
    this.buildInspector();
  }

  togglePlay() {
    this.engine.paused = !this.engine.paused;
    $('btn-play').textContent = this.engine.paused ? '▶' : '❚❚';
  }

  buildList() {
    const ul = $('object-list');
    ul.innerHTML = '';
    if (!this.scene.objects.length) {
      const li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No objects yet — add one above.';
      ul.appendChild(li);
      return;
    }
    for (const o of this.scene.objects) {
      const li = document.createElement('li');
      if (o === this.scene.selected) li.className = 'selected';
      const dot = document.createElement('span');
      dot.className = 'dot';
      dot.style.background = o.color;
      li.appendChild(dot);
      li.appendChild(document.createTextNode(o.name));
      li.onclick = () => this.scene.select(o);
      ul.appendChild(li);
    }
  }

  sliderRow(target, def) {
    const row = document.createElement('label');
    row.className = 'slider-row';
    const lbl = document.createElement('span');
    lbl.className = 'lbl';
    const name = document.createElement('span');
    name.textContent = def.label;
    const val = document.createElement('span');
    val.className = 'val';
    const fmt = v => `${(+v).toFixed(fmtDecimals(def.step))} ${def.unit}`;
    val.textContent = fmt(target[def.key]);
    lbl.append(name, val);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = def.min;
    input.max = def.max;
    input.step = def.step;
    input.value = target[def.key];
    input.oninput = () => {
      target[def.key] = +input.value; // applied live, mid-swing
      val.textContent = fmt(input.value);
    };
    row.append(lbl, input);
    return row;
  }

  smallButton(text, title, onclick) {
    const b = document.createElement('button');
    b.className = 'mini';
    b.textContent = text;
    b.title = title;
    b.onclick = onclick;
    return b;
  }

  buildInspector() {
    const o = this.scene.selected;
    $('inspector').hidden = !o;
    if (!o) return;

    $('insp-name').textContent = o.name;
    $('insp-trail').checked = o.showTrail;
    $('insp-vectors').checked = o.showVectors;

    const box = $('insp-params');
    box.innerHTML = '';
    for (const { i, depth } of o.linkTreeOrder()) {
      const link = o.links[i];
      const sec = document.createElement('div');
      sec.className = 'link-section';
      sec.style.marginLeft = `${depth * 12}px`;

      const head = document.createElement('div');
      head.className = 'link-head';
      const title = document.createElement('span');
      title.className = 'link-title';
      title.textContent = `${link.constructor.kind} ${i + 1}`;
      head.appendChild(title);
      head.appendChild(this.smallButton('+ rod', 'Hang a rod link from this mass', () => {
        o.appendLink(RodLink, i);
        this.buildInspector();
      }));
      head.appendChild(this.smallButton('+ spring', 'Hang a spring link from this mass', () => {
        o.appendLink(SpringLink, i);
        this.buildInspector();
      }));
      if (o.parents[i] >= 0) {
        head.appendChild(this.smallButton('✕', 'Remove this link and everything below it', () => {
          o.removeLink(i);
          this.buildInspector();
        }));
      }
      sec.appendChild(head);

      for (const def of link.constructor.paramDefs) sec.appendChild(this.sliderRow(link, def));
      box.appendChild(sec);
    }
  }

  // Called every render frame.
  updateReadouts() {
    const o = this.scene.selected;
    if (!o) return;
    const { ke, pe } = o.energy(this.scene.gravity);
    $('ro-ke').textContent = `${ke.toFixed(2)} J`;
    $('ro-pe').textContent = `${pe.toFixed(2)} J`;
    $('ro-tot').textContent = `${(ke + pe).toFixed(2)} J`;
    $('ro-period').textContent = o.lastPeriod ? `${o.lastPeriod.toFixed(2)} s` : '—';
    this.drawGraph(o);
  }

  drawGraph(o) {
    const c = this.graph;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = this.graphCtx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#10151c';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const WINDOW = 12; // seconds shown
    const t1 = this.scene.time;
    const t0 = t1 - WINDOW;
    let maxAbs = 0.25;
    for (const [, v] of o.history) maxAbs = Math.max(maxAbs, Math.abs(v));

    if (o.history.length > 1) {
      ctx.strokeStyle = o.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      for (const [t, v] of o.history) {
        const x = ((t - t0) / WINDOW) * w;
        const y = h / 2 - (v / maxAbs) * (h / 2 - 8);
        if (started) ctx.lineTo(x, y);
        else { ctx.moveTo(x, y); started = true; }
      }
      ctx.stroke();
    }

    ctx.fillStyle = '#8b97a5';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(o.coordLabel(), 6, 12);
  }
}
