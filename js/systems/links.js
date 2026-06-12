// Link types that make up an assembly. Each link hangs from its parent's
// mass (or the anchor) and carries a point mass at its far end.
//   RodLink:    rigid, one DOF (angle from vertical).
//   SpringLink: Hooke spring, two DOFs (angle, current length).
export class RodLink {
  static kind = 'Rod';
  static dofCount = 1;
  static paramDefs = [
    { key: 'length',  label: 'Length',  unit: 'm',  min: 0.2, max: 3.5, step: 0.01, value: 1.0 },
    { key: 'mass',    label: 'Mass',    unit: 'kg', min: 0.1, max: 10,  step: 0.1,  value: 1.5 },
    { key: 'damping', label: 'Damping', unit: '/s', min: 0,   max: 2,   step: 0.01, value: 0 },
  ];
  constructor(overrides = {}) {
    for (const d of this.constructor.paramDefs) this[d.key] = overrides[d.key] ?? d.value;
  }
}

export class SpringLink {
  static kind = 'Spring';
  static dofCount = 2;
  static paramDefs = [
    { key: 'k',       label: 'Spring constant', unit: 'N/m', min: 2,   max: 200, step: 1,    value: 40 },
    { key: 'restLen', label: 'Rest length',     unit: 'm',   min: 0.3, max: 2,   step: 0.01, value: 1.0 },
    { key: 'mass',    label: 'Mass',            unit: 'kg',  min: 0.1, max: 10,  step: 0.1,  value: 1.5 },
    { key: 'damping', label: 'Damping',         unit: '/s',  min: 0,   max: 2,   step: 0.01, value: 0 },
  ];
  constructor(overrides = {}) {
    for (const d of this.constructor.paramDefs) this[d.key] = overrides[d.key] ?? d.value;
  }
}
