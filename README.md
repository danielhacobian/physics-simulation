# Springs & Pendulums

An interactive 2D physics simulation of pendulums, springs, and arbitrary
chains and trees built from them — hang a spring off a pendulum, a pendulum
off that spring, or branch several links from one mass. Plain HTML + vanilla
JavaScript (ES modules) rendering to a `<canvas>` — no build step, no
dependencies.

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
  buttons. New objects hang from the next free spot along the ceiling. These
  are just starting shapes — every object is a tree of links underneath.
- **Build chains and trees:** in the inspector, every link section has
  `+ rod` and `+ spring` buttons that hang a new link from that link's mass,
  and `✕` removes a link together with everything below it. Spring links
  swing freely (elastic pendulums), so spring→pendulum→spring chains behave
  properly.
- **Drag a mass** to position it; release to let it swing or bob (it starts
  from rest at the release point). **Drag an anchor bracket** to move a whole
  system anywhere on the canvas.
- **Click an object** (or its name in the list) to select it. The inspector
  shows one section per link — length, mass, spring constant, damping, etc. —
  as sliders that apply **live, mid-swing**, plus toggles for the motion
  trails (one per leaf mass) and velocity/force vectors, live
  kinetic/potential/total energy readouts, the measured oscillation period,
  and a scrolling graph of the root angle (or displacement, for a lone
  spring).
- **Global controls:** gravity slider (try 1.62 for the Moon), pause/play
  (Space), reset, and a simulation-speed slider for slow motion.

All quantities are in real SI units (m, kg, N/m, J, s), so periods match the
textbook formulas: T ≈ 2π√(L/g) for small-angle pendulums and T = 2π√(m/k)
for springs.

## Physics

Every object is a tree of links rooted at its anchor: rigid rods (one degree
of freedom, the angle) and springs (two — angle and length), each carrying a
point mass. The equations of motion are derived exactly via d'Alembert's
principle in generalised coordinates: the mass matrix `M(q)` and bias forces
reduce to subtree-mass sums thanks to the tree structure, and `M q̈ = Q` is
solved each evaluation by Gaussian elimination. No small-angle approximation,
no constraint drift. Integration is classic 4th-order Runge-Kutta at a fixed
240 Hz timestep, decoupled from the render frame rate. With damping at zero,
total energy is conserved to roughly one part in 10⁸ — watch the Total
readout to verify. The two-rod chain reproduces the closed-form double
pendulum equations to machine precision (see tests).

## Architecture

```
index.html, style.css     page shell and dark theme
js/main.js                wiring + fixed-timestep simulation loop
js/scene.js               object collection, selection, auto-placement
js/renderer.js            canvas drawing: grid, trails, masses, vectors
js/interaction.js         pointer handling (drag masses and anchors)
js/ui.js                  sidebar inspector (per-link sections), graph
js/rk4.js                 generic RK4 integrator
js/systems/base.js        shared PhysicsObject behaviour (trails, period…)
js/systems/links.js       RodLink and SpringLink parameter definitions
js/systems/assembly.js    the tree solver: dynamics, energy, drag, drawing
js/systems/presets.js     Pendulum / Spring / Double pendulum starting shapes
```

Links declare their parameters in a `paramDefs` list; the inspector builds
sliders from it automatically. A new link type (e.g. a rigid rod with
distributed mass, or a damped piston) means one new class in `links.js` plus
its dynamics terms in `assembly.js`.

## Tests

Headless physics checks (energy conservation, analytical periods, damping):

```sh
node test/physics.test.mjs
```
