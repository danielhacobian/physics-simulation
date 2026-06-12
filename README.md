# Springs & Pendulums

An interactive 2D physics simulation of pendulums, spring-mass systems, and
double pendulums. Plain HTML + vanilla JavaScript (ES modules) rendering to a
`<canvas>` — no build step, no dependencies.

## Running

Serve the directory with any static file server and open it in a browser:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

(A server is needed because the app uses ES modules, which browsers won't load
from `file://` URLs.)

## Using it

- **Add objects** with the `+ Pendulum`, `+ Spring`, and `+ Double pendulum`
  buttons. New objects hang from the next free spot along the ceiling.
- **Drag a mass** to position it; release to let it swing or bob (it starts
  from rest at the release point). **Drag an anchor bracket** to move a whole
  system anywhere on the canvas.
- **Click an object** (or its name in the list) to select it. The inspector
  shows its parameters — wire length, mass, spring constant, damping, etc. —
  as sliders that apply **live, mid-swing**, plus toggles for the motion trail
  and velocity/force vectors, live kinetic/potential/total energy readouts,
  the measured oscillation period, and a scrolling graph of its angle or
  displacement.
- **Global controls:** gravity slider (try 1.62 for the Moon), pause/play
  (Space), reset, and a simulation-speed slider for slow motion.

All quantities are in real SI units (m, kg, N/m, J, s), so periods match the
textbook formulas: T ≈ 2π√(L/g) for small-angle pendulums and T = 2π√(m/k)
for springs.

## Physics

Equations of motion are fully nonlinear (no small-angle approximation) and
integrated with classic 4th-order Runge-Kutta at a fixed 240 Hz timestep,
decoupled from the render frame rate. With damping at zero, total energy is
conserved to roughly one part in 10⁹ — watch the Total readout to verify.

## Architecture

```
index.html, style.css        page shell and dark theme
js/main.js                   wiring + fixed-timestep simulation loop
js/scene.js                  object collection, selection, auto-placement
js/renderer.js               canvas drawing: grid, trails, masses, vectors
js/interaction.js            pointer handling (drag masses and anchors)
js/ui.js                     sidebar inspector, transport bar, graph
js/rk4.js                    generic RK4 integrator
js/systems/base.js           shared PhysicsObject behaviour
js/systems/pendulum.js       simple pendulum
js/systems/springmass.js     vertical spring-mass
js/systems/doublependulum.js chaotic double pendulum
```

Each system type is a class extending `PhysicsObject` with a declarative
`paramDefs` list; the inspector builds its sliders from that list
automatically. To add a new system type (e.g. a spring pendulum), write one
new class in `js/systems/`, register it in `main.js` and `ui.js`, and add a
button — no other code changes needed.

## Tests

Headless physics checks (energy conservation, analytical periods, damping):

```sh
node test/physics.test.mjs
```
