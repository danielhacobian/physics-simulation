# Springs & Pendulums

A small web-based physics toy: add pendulums and springs, then adjust them
with sliders and watch them move. The simulation is written in **Python** and
runs right in the browser using [PyScript](https://pyscript.net/).

## Try it

Because PyScript loads from the web, you need to open the page through a
little web server (not by double-clicking the file).

```sh
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

The first load takes a few seconds while PyScript downloads the Python
runtime. After that it's quick.

## What you can do

- **Add objects** with the `+ Pendulum` and `+ Spring` buttons.
- **Click** an object to select it (it gets a white outline).
- **Sliders** change the selected object: a pendulum's length, a spring's
  stiffness, and either one's mass. The gravity slider affects everything.
- **Pause** and **Reset** with the buttons.

## How it works

Each object steps forward in tiny time slices (1/60 of a second):

- **Pendulum** — it accelerates toward the bottom based on how far out it is
  swung (`-(gravity / length) * sin(angle)`).
- **Spring** — gravity pulls the mass down while the spring pulls back the
  more it's stretched (Hooke's law: `gravity - (stiffness / mass) * stretch`).

## Files

```
index.html        the page: canvas, buttons, and sliders
style.css         colours and layout
main.py           the simulation (Pendulum and Spring classes + drawing)
test_physics.py   quick checks you can run without a browser
```

## Tests

The physics doesn't need a browser to test, so you can run:

```sh
python3 test_physics.py
```
