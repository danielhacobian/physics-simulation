"""Springs & Pendulums - a small physics toy.

This file runs in two places:
  * In the browser, through PyScript, where it draws on a <canvas> and
    listens to the buttons and sliders.
  * In plain Python (for the tests in test_physics.py), where it just uses
    the Pendulum and Spring classes.

The `try` below is what lets that work: the browser-only imports simply
aren't there when we run with regular Python, so we skip them.
"""

import math

try:
    from js import document, window
    from pyodide.ffi import create_proxy
    IN_BROWSER = True
except ImportError:
    IN_BROWSER = False


# --- settings ---
SCALE = 150       # pixels per metre
ANCHOR_Y = 70     # how far down the "ceiling" is, in pixels
DT = 1 / 60       # physics time step, in seconds


def bob_radius(mass):
    """Heavier bobs are drawn a little bigger."""
    return 10 + mass * 4


class Pendulum:
    def __init__(self, anchor_x):
        self.anchor_x = anchor_x
        self.length = 1.5     # metres
        self.mass = 1.0       # kilograms
        self.angle = 0.6      # radians away from straight down
        self.speed = 0.0      # how fast the angle is changing
        self.color = "#4fc3f7"

    def update(self, gravity):
        # A swinging pendulum speeds up the most when it is furthest out.
        acceleration = -(gravity / self.length) * math.sin(self.angle)
        self.speed += acceleration * DT
        self.angle += self.speed * DT

    def bob_position(self):
        x = self.anchor_x + self.length * SCALE * math.sin(self.angle)
        y = ANCHOR_Y + self.length * SCALE * math.cos(self.angle)
        return x, y

    def reset(self):
        self.angle = 0.6
        self.speed = 0.0


class Spring:
    def __init__(self, anchor_x):
        self.anchor_x = anchor_x
        self.stiffness = 30.0    # N/m - how strong the spring is
        self.mass = 1.0          # kilograms
        self.rest_length = 1.0   # the length the spring "wants" to be, metres
        self.length = 1.6        # current length, starts stretched so it bobs
        self.speed = 0.0
        self.color = "#ffb74d"

    def update(self, gravity):
        # Hooke's law: the more it is stretched, the harder it pulls back.
        stretch = self.length - self.rest_length
        acceleration = gravity - (self.stiffness / self.mass) * stretch
        self.speed += acceleration * DT
        self.length += self.speed * DT

    def bob_position(self):
        x = self.anchor_x
        y = ANCHOR_Y + self.length * SCALE
        return x, y

    def reset(self):
        self.length = 1.6
        self.speed = 0.0


# ----------------------------------------------------------------------
# Everything below this point only runs in the browser (through PyScript).
# ----------------------------------------------------------------------

objects = []
selected = None
gravity = 9.8
paused = False
_proxies = []   # keep references so the browser doesn't discard our callbacks


def add_pendulum(event=None):
    x = 120 + len(objects) * 140
    objects.append(Pendulum(x))


def add_spring(event=None):
    x = 120 + len(objects) * 140
    objects.append(Spring(x))


def toggle_pause(event=None):
    global paused
    paused = not paused
    document.getElementById("pause").innerText = "Play" if paused else "Pause"


def reset_all(event=None):
    for obj in objects:
        obj.reset()


def on_canvas_click(event):
    """Select the object whose bob was clicked."""
    global selected
    rect = canvas.getBoundingClientRect()
    mouse_x = event.clientX - rect.left
    mouse_y = event.clientY - rect.top
    selected = None
    for obj in objects:
        bx, by = obj.bob_position()
        if (mouse_x - bx) ** 2 + (mouse_y - by) ** 2 <= (bob_radius(obj.mass) + 6) ** 2:
            selected = obj
            break
    update_panel()


def update_panel():
    """Show the selected object's values on the sliders."""
    label = document.getElementById("selected-label")
    if selected is None:
        label.innerText = "Click an object to adjust it"
        return
    if isinstance(selected, Pendulum):
        label.innerText = "Selected: Pendulum"
        document.getElementById("length").value = selected.length
        document.getElementById("length-val").innerText = f"{selected.length:.2f}"
    else:
        label.innerText = "Selected: Spring"
        document.getElementById("stiffness").value = selected.stiffness
        document.getElementById("stiffness-val").innerText = f"{selected.stiffness:.0f}"
    document.getElementById("mass").value = selected.mass
    document.getElementById("mass-val").innerText = f"{selected.mass:.1f}"


def on_gravity(event):
    global gravity
    gravity = float(event.target.value)
    document.getElementById("gravity-val").innerText = f"{gravity:.1f}"


def on_length(event):
    document.getElementById("length-val").innerText = f"{float(event.target.value):.2f}"
    if isinstance(selected, Pendulum):
        selected.length = float(event.target.value)


def on_mass(event):
    document.getElementById("mass-val").innerText = f"{float(event.target.value):.1f}"
    if selected is not None:
        selected.mass = float(event.target.value)


def on_stiffness(event):
    document.getElementById("stiffness-val").innerText = f"{float(event.target.value):.0f}"
    if isinstance(selected, Spring):
        selected.stiffness = float(event.target.value)


def draw_spring(x0, y0, x1, y1):
    """A zig-zag line so springs look different from pendulum strings."""
    coils = 10
    width = 8
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    for i in range(1, coils):
        t = i / coils
        offset = width if i % 2 == 1 else -width
        ctx.lineTo(x0 + (x1 - x0) * t + offset, y0 + (y1 - y0) * t)
    ctx.lineTo(x1, y1)
    ctx.stroke()


def draw():
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    # the ceiling everything hangs from
    ctx.strokeStyle = "#555"
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(0, ANCHOR_Y)
    ctx.lineTo(canvas.width, ANCHOR_Y)
    ctx.stroke()

    for obj in objects:
        bx, by = obj.bob_position()

        # the string (pendulum) or the coiled spring
        ctx.strokeStyle = "#999"
        ctx.lineWidth = 2
        if isinstance(obj, Spring):
            draw_spring(obj.anchor_x, ANCHOR_Y, bx, by)
        else:
            ctx.beginPath()
            ctx.moveTo(obj.anchor_x, ANCHOR_Y)
            ctx.lineTo(bx, by)
            ctx.stroke()

        # the bob
        ctx.beginPath()
        ctx.arc(bx, by, bob_radius(obj.mass), 0, 2 * math.pi)
        ctx.fillStyle = obj.color
        ctx.fill()
        if obj is selected:
            ctx.strokeStyle = "white"
            ctx.lineWidth = 3
            ctx.stroke()


def tick(timestamp=None):
    if not paused:
        for obj in objects:
            obj.update(gravity)
    draw()
    window.requestAnimationFrame(tick_proxy)


def listen(element_id, event_name, handler):
    proxy = create_proxy(handler)
    _proxies.append(proxy)
    document.getElementById(element_id).addEventListener(event_name, proxy)


if IN_BROWSER:
    canvas = document.getElementById("sim")
    ctx = canvas.getContext("2d")

    listen("add-pendulum", "click", add_pendulum)
    listen("add-spring", "click", add_spring)
    listen("pause", "click", toggle_pause)
    listen("reset", "click", reset_all)
    listen("sim", "click", on_canvas_click)
    listen("gravity", "input", on_gravity)
    listen("length", "input", on_length)
    listen("mass", "input", on_mass)
    listen("stiffness", "input", on_stiffness)

    # start with one of each so the page isn't empty
    add_pendulum()
    add_spring()

    tick_proxy = create_proxy(tick)
    window.requestAnimationFrame(tick_proxy)
