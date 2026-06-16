"""Quick checks on the physics, runnable with plain Python:

    python3 test_physics.py

These don't need a browser - they just use the Pendulum and Spring classes.
"""

import math
from main import Pendulum, Spring, DoublePendulum, DT, SUBSTEPS


def double_pendulum_energy(d, gravity=9.8):
    """Total energy of a double pendulum (used to check it stays stable)."""
    y1 = d.length1 * math.cos(d.angle1)
    y2 = y1 + d.length2 * math.cos(d.angle2)
    v1sq = (d.length1 * d.speed1) ** 2
    v2sq = (v1sq + (d.length2 * d.speed2) ** 2
            + 2 * d.length1 * d.length2 * d.speed1 * d.speed2 * math.cos(d.angle1 - d.angle2))
    kinetic = 0.5 * d.mass1 * v1sq + 0.5 * d.mass2 * v2sq
    potential = -gravity * (d.mass1 * y1 + d.mass2 * y2)
    return kinetic + potential


def test_pendulum_swings():
    p = Pendulum(anchor_x=200)
    angles = []
    for _ in range(600):          # 10 seconds at 60 fps
        p.update(gravity=9.8)
        angles.append(p.angle)
    assert min(angles) < 0, "pendulum should swing to the other side"
    assert max(angles) > 0, "pendulum should swing back"
    assert max(abs(a) for a in angles) < 1.0, "pendulum shouldn't gain energy and fly around"
    assert not math.isnan(p.angle), "angle went to NaN"
    print("PASS  pendulum swings back and forth and stays bounded")


def test_pendulum_length_changes_speed():
    short = Pendulum(anchor_x=0)
    short.length = 0.6
    long = Pendulum(anchor_x=0)
    long.length = 3.0
    # Count how many times each crosses zero in 10 s; shorter = faster = more.
    def crossings(p):
        count, prev = 0, p.angle
        for _ in range(600):
            p.update(gravity=9.8)
            if (prev < 0) != (p.angle < 0):
                count += 1
            prev = p.angle
        return count
    assert crossings(short) > crossings(long), "shorter pendulums should swing faster"
    print("PASS  shorter pendulum swings faster than a longer one")


def test_spring_oscillates_around_equilibrium():
    s = Spring(anchor_x=400)
    equilibrium = s.rest_length + (s.mass * 9.8) / s.stiffness
    lengths = []
    for _ in range(600):
        s.update(gravity=9.8)
        lengths.append(s.length)
    assert min(lengths) < equilibrium, "spring should bob above equilibrium"
    assert max(lengths) > equilibrium, "spring should bob below equilibrium"
    assert max(lengths) < 3.0, "spring shouldn't blow up"
    assert not math.isnan(s.length), "length went to NaN"
    print("PASS  spring bobs around its equilibrium length")


def test_no_gravity_pendulum_is_still():
    p = Pendulum(anchor_x=0)
    start = p.angle
    for _ in range(300):
        p.update(gravity=0)
    assert abs(p.angle - start) < 1e-9, "with no gravity a still pendulum shouldn't move"
    print("PASS  with zero gravity the pendulum stays put")


def test_double_pendulum_is_stable():
    # A double pendulum is chaotic, so we don't expect it to repeat - but it
    # must not "explode" (gain energy and spin faster and faster). We run it
    # the same way the browser does: SUBSTEPS small steps per frame.
    d = DoublePendulum(anchor_x=400)
    start_energy = double_pendulum_energy(d)
    small_dt = DT / SUBSTEPS
    worst_drift = 0.0
    fastest = 0.0
    for _ in range(30 * 60 * SUBSTEPS):    # 30 simulated seconds
        d.update(9.8, small_dt)
        worst_drift = max(worst_drift, abs(double_pendulum_energy(d) - start_energy))
        fastest = max(fastest, abs(d.speed1), abs(d.speed2))
    assert not math.isnan(d.angle1), "double pendulum blew up to NaN"
    assert fastest < 20, "double pendulum is spinning unrealistically fast"
    assert worst_drift < 0.5 * abs(start_energy), "double pendulum is gaining too much energy"
    print(f"PASS  double pendulum stays stable (energy drift "
          f"{worst_drift / abs(start_energy) * 100:.1f}% over 30 s)")


if __name__ == "__main__":
    test_pendulum_swings()
    test_pendulum_length_changes_speed()
    test_spring_oscillates_around_equilibrium()
    test_no_gravity_pendulum_is_still()
    test_double_pendulum_is_stable()
    print("\nAll checks passed.")
