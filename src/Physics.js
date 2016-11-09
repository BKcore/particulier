import World from 'cannon/src/world/World';
import Plane from 'cannon/src/shapes/Plane';
import Box from 'cannon/src/shapes/Box';
import Body from 'cannon/src/objects/Body';
import Vec3 from 'cannon/src/math/Vec3';

import { IterableDict } from './Utils.js';

export class Physics {

  constructor() {
    this.world = new World();
    this.world.gravity.set(0, -10, 0);
    this.world.solver.tolerance = 0.001
    this.world.doProfiling = false;
    this.bodyToObject = {};
    this.objectToBody = {};
    this.staticBodies = new IterableDict();
    this.dynamicBodies = new IterableDict();
  }

  getBodyOfObject(object) {
    return this.objectToBody[object.uuid];
  }

  getObjectOfBody(body) {
    return this.bodyToObject[body.id];
  }

  createGroundBody(object) {
    let plane = new Plane();
    let body = new Body({mass: 0});
    body.addShape(plane);
    this.registerAndBind(body, object, false);
    body.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI / 2);
    console.log("XXX GROUND", body);
    this.ground = body;
  }

  createBoxBody(object, sx, sy, sz, mass = 1) {
    let shape = new Box(new Vec3(sx / 2, sy / 2, sz / 2));
    let body = new Body({mass: mass});
    body.addShape(shape);
    this.registerAndBind(body, object, mass > 0);
    return body;
  }

  registerAndBind(body, object, dynamic) {
    this.world.addBody(body);
    body.position.copy(object.position);
    body.quaternion.copy(object.quaternion);
    this.bodyToObject[body.id] = object;
    this.objectToBody[object.uuid] = body;
    let container = dynamic ? this.dynamicBodies : this.staticBodies;
    container.set(body.id, body);
  }

  tick(dt) {
    this.world.step(dt);
    for(let body of this.dynamicBodies.values) {
      let object = this.getObjectOfBody(body);
      if(object == null) { continue; }
      object.position.copy(body.position);
      object.quaternion.copy(body.quaternion);
    }
  }
}