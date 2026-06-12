// Headless physics checks: run with `node test/physics.test.mjs`.
// Verifies energy conservation under RK4 and compares measured periods
// against the analytical small-oscillation formulas.
import { Pendulum } from '../js/systems/pendulum.js';
import { SpringMass } from '../js/systems/springmass.js';
import { DoublePendulum } from '../js/systems/doublependulum.js';

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

{
  const p = new Pendulum({ x: 0, y: 0 });
  p.state = [1.2, 0];
  const { e0, maxDrift } = run(p, 60);
  check('pendulum: energy conserved over 60 s', maxDrift / e0 < 1e-6,
    `relative drift ${(maxDrift / e0).toExponential(2)}`);
}

{
  const p = new Pendulum({ x: 0, y: 0 });
  p.state = [0.05, 0];
  run(p, 12);
  const expected = 2 * Math.PI * Math.sqrt(p.length / G);
  check('pendulum: small-angle period ≈ 2π√(L/g)',
    p.lastPeriod !== null && Math.abs(p.lastPeriod - expected) / expected < 0.005,
    `measured ${p.lastPeriod?.toFixed(4)} s, expected ${expected.toFixed(4)} s`);
}

{
  const s = new SpringMass({ x: 0, y: 0 }, G);
  const { e0, maxDrift } = run(s, 30);
  check('spring: energy conserved over 30 s', maxDrift / e0 < 1e-6,
    `relative drift ${(maxDrift / e0).toExponential(2)}`);
  const expected = 2 * Math.PI * Math.sqrt(s.mass / s.k);
  check('spring: period ≈ 2π√(m/k)',
    s.lastPeriod !== null && Math.abs(s.lastPeriod - expected) / expected < 0.005,
    `measured ${s.lastPeriod?.toFixed(4)} s, expected ${expected.toFixed(4)} s`);
}

{
  const d = new DoublePendulum({ x: 0, y: 0 });
  const { e0, maxDrift } = run(d, 30);
  check('double pendulum: energy conserved over 30 s', maxDrift / e0 < 1e-3,
    `relative drift ${(maxDrift / e0).toExponential(2)}`);
}

{
  const p = new Pendulum({ x: 0, y: 0 });
  p.damping = 0.3;
  p.state = [1.0, 0];
  const e0 = p.energy(G).ke + p.energy(G).pe;
  run(p, 20);
  const e1 = p.energy(G).ke + p.energy(G).pe;
  check('pendulum: damping dissipates energy', e1 < 0.2 * e0,
    `${e0.toFixed(3)} J → ${e1.toFixed(3)} J after 20 s`);
}

process.exit(failures ? 1 : 0);
