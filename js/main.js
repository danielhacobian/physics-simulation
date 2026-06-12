import { Scene } from './scene.js';
import { Renderer } from './renderer.js';
import { UI } from './ui.js';
import { attachInteraction } from './interaction.js';
import { Pendulum, SpringMass, DoublePendulum } from './systems/presets.js';

const canvas = document.getElementById('sim');
const scene = new Scene();
const renderer = new Renderer(canvas, scene);
const engine = { paused: false, timeScale: 1 };
const ui = new UI(scene, engine, renderer, { Pendulum, SpringMass, DoublePendulum });
attachInteraction(canvas, scene);

// Default scene: one pendulum and one spring, already displaced so they move.
scene.add(Pendulum, renderer.widthM);
scene.add(SpringMass, renderer.widthM);
scene.select(scene.objects[0]);

// Handy for experimenting from the browser console (and for tests).
window.scene = scene;

// Fixed physics timestep, decoupled from the render frame rate.
const DT = 1 / 240;
let last = performance.now();
let acc = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1); // clamp after tab switches
  last = now;
  if (!engine.paused) {
    acc += dt * engine.timeScale;
    while (acc >= DT) {
      scene.step(DT);
      acc -= DT;
    }
  }
  renderer.draw();
  ui.updateReadouts();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
