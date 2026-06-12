import { Assembly } from './assembly.js';
import { RodLink, SpringLink } from './links.js';

// The "add object" buttons create these starting shapes; from there any
// object can be extended into an arbitrary tree via the inspector.
export class Pendulum extends Assembly {
  static typeName = 'Pendulum';
  constructor(anchor, g) {
    super(anchor, g);
    this.appendLink(RodLink, -1, { length: 1.6 }, { theta: 0.7 });
  }
}

export class SpringMass extends Assembly {
  static typeName = 'Spring';
  constructor(anchor, g = 9.81) {
    super(anchor, g);
    this.appendLink(SpringLink, -1);
    this.state[1] += 0.45; // start displaced below equilibrium so it bobs
    this.initialState = [...this.state];
  }
}

export class DoublePendulum extends Assembly {
  static typeName = 'Double pendulum';
  constructor(anchor, g) {
    super(anchor, g);
    this.appendLink(RodLink, -1, { length: 1.0 }, { theta: Math.PI / 2 });
    this.appendLink(RodLink, 0, { length: 1.0 }, { theta: Math.PI / 2 + 0.6 });
  }
}
