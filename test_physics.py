"""Quick checks on the physics, runnable with plain Python:

    python3 test_physics.py

These don't need a browser - they just use the Pendulum and Spring classes.
"""

import math
from main import Pendulum, Spring, DT


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


if __name__ == "__main__":
    test_pendulum_swings()
    test_pendulum_length_changes_speed()
    test_spring_oscillates_around_equilibrium()
    test_no_gravity_pendulum_is_still()
    print("\nAll checks passed.")
