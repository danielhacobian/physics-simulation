"""Springs & Pendulums - a small physics toy.

This file runs in two places:
  * In the browser, through PyScript, where it draws on a <canvas> and
    listens to the buttons and sliders.
  * In plain Python (for the tests in test_physics.py), where it just uses
    the Pendulum, Spring, and DoublePendulum classes.

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
SCALE = 150        # pixels per metre
ANCHOR_Y = 70      # how far down the "ceiling" is, in pixels
DT = 1 / 60        # how much time passes per drawn frame, in seconds
SUBSTEPS = 16      # we split each frame into smaller steps for accuracy
                   # (the double pendulum needs this to stay stable)


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

    def update(self, gravity, dt=DT):
        # A swinging pendulum speeds up the most when it is furthest out.
        acceleration = -(gravity / self.length) * math.sin(self.angle)
        self.speed += acceleration * dt
        self.angle += self.speed * dt

    def bobs(self):
        x = self.anchor_x + self.length * SCALE * math.sin(self.angle)
        y = ANCHOR_Y + self.length * SCALE * math.cos(self.angle)
        return [(x, y, self.mass)]

    def draw_shape(self, ctx):
        x, y, _ = self.bobs()[0]
        ctx.strokeStyle = "#999"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(self.anchor_x, ANCHOR_Y)
        ctx.lineTo(x, y)
        ctx.stroke()

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

    def update(self, gravity, dt=DT):
        # Hooke's law: the more it is stretched, the harder it pulls back.
        stretch = self.length - self.rest_length
        acceleration = gravity - (self.stiffness / self.mass) * stretch
        self.speed += acceleration * dt
        self.length += self.speed * dt

    def bobs(self):
        return [(self.anchor_x, ANCHOR_Y + self.length * SCALE, self.mass)]

    def draw_shape(self, ctx):
        _, y, _ = self.bobs()[0]
        ctx.strokeStyle = "#999"
        ctx.lineWidth = 2
        draw_spring(ctx, self.anchor_x, ANCHOR_Y, self.anchor_x, y)

    def reset(self):
        self.length = 1.6
        self.speed = 0.0


class DoublePendulum:
    """One pendulum hanging off the end of another - famously chaotic."""

    def __init__(self, anchor_x):
        self.anchor_x = anchor_x
        self.length1 = 1.2
        self.length2 = 1.2
        self.mass1 = 1.0
        self.mass2 = 1.0
        self.angle1 = 1.2     # radians from straight down
        self.angle2 = 1.0
        self.speed1 = 0.0
        self.speed2 = 0.0
        self.color = "#f06292"

    def update(self, gravity, dt=DT):
        # The standard equations of motion for a double pendulum. They look
        # busy, but it's just two accelerations worked out from the angles
        # and speeds. (den is never zero because 2*m1+m2 > m2.)
        t1, t2 = self.angle1, self.angle2
        w1, w2 = self.speed1, self.speed2
        m1, m2 = self.mass1, self.mass2
        L1, L2 = self.length1, self.length2
        g = gravity
        delta = t1 - t2
        den = 2 * m1 + m2 - m2 * math.cos(2 * delta)

        accel1 = (
            -g * (2 * m1 + m2) * math.sin(t1)
            - m2 * g * math.sin(t1 - 2 * t2)
            - 2 * math.sin(delta) * m2 * (w2 * w2 * L2 + w1 * w1 * L1 * math.cos(delta))
        ) / (L1 * den)

        accel2 = (
            2 * math.sin(delta) * (
                w1 * w1 * L1 * (m1 + m2)
                + g * (m1 + m2) * math.cos(t1)
                + w2 * w2 * L2 * m2 * math.cos(delta)
            )
        ) / (L2 * den)

        self.speed1 += accel1 * dt
        self.speed2 += accel2 * dt
        self.angle1 += self.speed1 * dt
        self.angle2 += self.speed2 * dt

    def bobs(self):
        x1 = self.anchor_x + self.length1 * SCALE * math.sin(self.angle1)
        y1 = ANCHOR_Y + self.length1 * SCALE * math.cos(self.angle1)
        x2 = x1 + self.length2 * SCALE * math.sin(self.angle2)
        y2 = y1 + self.length2 * SCALE * math.cos(self.angle2)
        return [(x1, y1, self.mass1), (x2, y2, self.mass2)]

    def draw_shape(self, ctx):
        (x1, y1, _), (x2, y2, _) = self.bobs()
        ctx.strokeStyle = "#999"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(self.anchor_x, ANCHOR_Y)
        ctx.lineTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()

    def reset(self):
        self.angle1 = 1.2
        self.angle2 = 1.0
        self.speed1 = 0.0
        self.speed2 = 0.0


# ----------------------------------------------------------------------
# Everything below this point only runs in the browser (through PyScript).
# ----------------------------------------------------------------------

objects = []
selected = None
gravity = 9.8
paused = False
_proxies = []   # keep references so the browser doesn't discard our callbacks


def next_x():
    return 120 + len(objects) * 140


def add_pendulum(event=None):
    objects.append(Pendulum(next_x()))


def add_spring(event=None):
    objects.append(Spring(next_x()))


def add_double(event=None):
    objects.append(DoublePendulum(next_x()))


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
        for bx, by, m in obj.bobs():
            if (mouse_x - bx) ** 2 + (mouse_y - by) ** 2 <= (bob_radius(m) + 6) ** 2:
                selected = obj
                break
        if selected is obj:
            break
    update_panel()


def set_slider(slider_id, value, fmt):
    document.getElementById(slider_id).value = value
    document.getElementById(slider_id + "-val").innerText = format(value, fmt)


def update_panel():
    """Show the selected object's values on the sliders."""
    label = document.getElementById("selected-label")
    if selected is None:
        label.innerText = "Click an object to adjust it"
        return
    if isinstance(selected, Pendulum):
        label.innerText = "Selected: Pendulum"
        set_slider("length", selected.length, ".2f")
        set_slider("mass", selected.mass, ".1f")
    elif isinstance(selected, Spring):
        label.innerText = "Selected: Spring"
        set_slider("stiffness", selected.stiffness, ".0f")
        set_slider("mass", selected.mass, ".1f")
    else:  # DoublePendulum
        label.innerText = "Selected: Double Pendulum"
        set_slider("length", selected.length1, ".2f")
        set_slider("mass", selected.mass1, ".1f")


def on_gravity(event):
    global gravity
    gravity = float(event.target.value)
    document.getElementById("gravity-val").innerText = f"{gravity:.1f}"


def on_length(event):
    value = float(event.target.value)
    document.getElementById("length-val").innerText = f"{value:.2f}"
    if isinstance(selected, Pendulum):
        selected.length = value
    elif isinstance(selected, DoublePendulum):
        selected.length1 = value
        selected.length2 = value


def on_mass(event):
    value = float(event.target.value)
    document.getElementById("mass-val").innerText = f"{value:.1f}"
    if isinstance(selected, DoublePendulum):
        selected.mass1 = value
        selected.mass2 = value
    elif selected is not None:
        selected.mass = value


def on_stiffness(event):
    value = float(event.target.value)
    document.getElementById("stiffness-val").innerText = f"{value:.0f}"
    if isinstance(selected, Spring):
        selected.stiffness = value


def draw_spring(ctx, x0, y0, x1, y1):
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
        obj.draw_shape(ctx)
        for bx, by, m in obj.bobs():
            ctx.beginPath()
            ctx.arc(bx, by, bob_radius(m), 0, 2 * math.pi)
            ctx.fillStyle = obj.color
            ctx.fill()
            if obj is selected:
                ctx.strokeStyle = "white"
                ctx.lineWidth = 3
                ctx.stroke()


def tick(timestamp=None):
    if not paused:
        # take several small steps each frame so the motion stays accurate
        small_dt = DT / SUBSTEPS
        for _ in range(SUBSTEPS):
            for obj in objects:
                obj.update(gravity, small_dt)
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
    listen("add-double", "click", add_double)
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
    add_double()

    tick_proxy = create_proxy(tick)
    window.requestAnimationFrame(tick_proxy)
