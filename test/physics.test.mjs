// Headless physics checks: run with `node test/physics.test.mjs`.
// Verifies the generalised tree solver: energy conservation under RK4,
// analytical small-oscillation periods, and an exact cross-check of the
// two-rod chain against the closed-form double-pendulum equations.
import { Assembly, RodLink, SpringLink } from '../js/systems/assembly.js';
import { Pendulum, SpringMass, DoublePendulum } from '../js/systems/presets.js';

const DT = 1 / 240;
const G = 9.81;
let failures = 0;

function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
}

function run(obj, seconds) {
  const total = () => { const { ke, pe } = obj.energy(G); return ke + pe; };
  const e0 = total();
  let maxDrift = 0;
  let t = 0;
  for (let i = 0, n = Math.round(seconds / DT); i < n; i++) {
    t += DT;
    obj.step(DT, G, t);
    maxDrift = Math.max(maxDrift, Math.abs(total() - e0));
  }
  return { e0, maxDrift };
}

// --- single rod (simple pendulum) ---
{
  const p = new Pendulum({ x: 0, y: 0 }, G);
  p.state = [1.2, 0];
  const { e0, maxDrift } = run(p, 60);
  check('rod: energy conserved over 60 s', maxDrift / e0 < 1e-6,
    `relative drift ${(maxDrift / e0).toExponential(2)}`);
}
{
  const p = new Pendulum({ x: 0, y: 0 }, G);
  p.state = [0.05, 0];
  run(p, 12);
  const expected = 2 * Math.PI * Math.sqrt(p.links[0].length / G);
  check('rod: small-angle period ≈ 2π√(L/g)',
    p.lastPeriod !== null && Math.abs(p.lastPeriod - expected) / expected < 0.005,
    `measured ${p.lastPeriod?.toFixed(4)} s, expected ${expected.toFixed(4)} s`);
}

// --- single spring, started vertical (classic spring-mass) ---
{
  const s = new SpringMass({ x: 0, y: 0 }, G);
  const { e0, maxDrift } = run(s, 30);
  check('spring (vertical): energy conserved over 30 s', maxDrift / e0 < 1e-6,
    `relative drift ${(maxDrift / e0).toExponential(2)}`);
  const link = s.links[0];
  const expected = 2 * Math.PI * Math.sqrt(link.mass / link.k);
  check('spring (vertical): period ≈ 2π√(m/k)',
    s.lastPeriod !== null && Math.abs(s.lastPeriod - expected) / expected < 0.005,
    `measured ${s.lastPeriod?.toFixed(4)} s, expected ${expected.toFixed(4)} s`);
}

// --- single spring displaced sideways (elastic pendulum, coupled DOFs) ---
{
  const s = new SpringMass({ x: 0, y: 0 }, G);
  const link = s.links[0];
  s.state = [0.8, link.restLen + (link.mass * G) / link.k + 0.2, 0, 0];
  const { e0, maxDrift } = run(s, 30);
  check('elastic pendulum: energy conserved over 30 s', maxDrift / e0 < 1e-6,
    `relative drift ${(maxDrift / e0).toExponential(2)}`);
}

// --- two-rod chain vs closed-form double-pendulum equations ---
{
  const analytic = ([t1, t2, w1, w2], { l1, l2, m1, m2 }, g) => {
    const D = t1 - t2;
    const den = 2 * m1 + m2 - m2 * Math.cos(2 * D);
    const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) -
      2 * Math.sin(D) * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * Math.cos(D))) / (l1 * den);
    const a2 = (2 * Math.sin(D) * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) +
      w2 * w2 * l2 * m2 * Math.cos(D))) / (l2 * den);
    return [a1, a2];
  };
  const params = { l1: 1.3, l2: 0.7, m1: 2.2, m2: 0.6 };
  const d = new DoublePendulum({ x: 0, y: 0 }, G);
  d.links[0].length = params.l1;
  d.links[1].length = params.l2;
  d.links[0].mass = params.m1;
  d.links[1].mass = params.m2;
  let worst = 0;
  for (const state of [[0.9, -0.5, 0.4, -1.1], [2.4, 0.3, -3.0, 1.7], [-1.2, 2.9, 0.0, 0.6]]) {
    const got = d.derivs(state, G).slice(2);   // [a1, a2]
    const want = analytic(state, params, G);
    worst = Math.max(worst,
      Math.abs(got[0] - want[0]) / Math.max(1, Math.abs(want[0])),
      Math.abs(got[1] - want[1]) / Math.max(1, Math.abs(want[1])));
  }
  check('two-rod chain matches closed-form double pendulum', worst < 1e-9,
    `worst relative error ${worst.toExponential(2)}`);
}
{
  const d = new DoublePendulum({ x: 0, y: 0 }, G);
  const { e0, maxDrift } = run(d, 30);
  check('double pendulum: energy conserved over 30 s', maxDrift / e0 < 1e-3,
    `relative drift ${(maxDrift / e0).toExponential(2)}`);
}

// --- mixed chain: rod -> spring -> rod ---
{
  const a = new Assembly({ x: 0, y: 0 }, G);
  a.appendLink(RodLink, -1, {}, { theta: 1.0 });
  a.appendLink(SpringLink, 0, {}, { theta: 0.4 });
  a.appendLink(RodLink, 1, {}, { theta: -0.6 });
  const { e0, maxDrift } = run(a, 30);
  check('mixed chain rod→spring→rod: energy conserved over 30 s',
    maxDrift / Math.max(1, e0) < 1e-4,
    `relative drift ${(maxDrift / Math.max(1, e0)).toExponential(2)}`);
}

// --- branching tree: spring root with two rod children ---
{
  const a = new Assembly({ x: 0, y: 0 }, G);
  a.appendLink(SpringLink, -1, {}, { theta: 0.3 });
  a.appendLink(RodLink, 0, {}, { theta: 1.0 });
  a.appendLink(RodLink, 0, {}, { theta: -0.8 });
  const { e0, maxDrift } = run(a, 30);
  check('branching tree (spring + two rods): energy conserved over 30 s',
    maxDrift / Math.max(1, e0) < 1e-4,
    `relative drift ${(maxDrift / Math.max(1, e0)).toExponential(2)}`);
}

// --- structure editing keeps the state vector consistent ---
{
  const a = new Assembly({ x: 0, y: 0 }, G);
  a.appendLink(RodLink, -1, {}, { theta: 0.5 });
  a.appendLink(SpringLink, 0, {}, { theta: 0.1 });
  a.appendLink(RodLink, 1, {}, { theta: -0.2 });
  a.appendLink(RodLink, 0, {}, { theta: 0.9 });    // branch off the root
  check('append: state length matches DOFs', a.state.length === 2 * a.ndof,
    `${a.state.length} vs 2×${a.ndof}`);
  a.removeLink(1); // removes the spring and the rod hanging from it
  check('remove subtree: links pruned', a.links.length === 2,
    `${a.links.length} links remain`);
  check('remove subtree: state length matches DOFs', a.state.length === 2 * a.ndof,
    `${a.state.length} vs 2×${a.ndof}`);
  check('remove subtree: parents reindexed', a.parents[0] === -1 && a.parents[1] === 0,
    `parents = ${JSON.stringify(a.parents)}`);
  run(a, 5);
  const { ke, pe } = a.energy(G);
  check('edited assembly still simulates', Number.isFinite(ke + pe),
    `E = ${(ke + pe).toFixed(3)} J`);
}

// --- damping dissipates ---
{
  const p = new Pendulum({ x: 0, y: 0 }, G);
  p.links[0].damping = 0.3;
  p.state = [1.0, 0];
  const e0 = p.energy(G).ke + p.energy(G).pe;
  run(p, 20);
  const e1 = p.energy(G).ke + p.energy(G).pe;
  check('damping dissipates energy', e1 < 0.2 * e0,
    `${e0.toFixed(3)} J → ${e1.toFixed(3)} J after 20 s`);
}

process.exit(failures ? 1 : 0);
