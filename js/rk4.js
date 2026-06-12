// Classic 4th-order Runge-Kutta step for an array state vector.
// deriv(state) must return the time-derivative of each state component.
export function rk4(state, deriv, dt) {
  const k1 = deriv(state);
  const k2 = deriv(state.map((v, i) => v + 0.5 * dt * k1[i]));
  const k3 = deriv(state.map((v, i) => v + 0.5 * dt * k2[i]));
  const k4 = deriv(state.map((v, i) => v + dt * k3[i]));
  return state.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
