import World from 'cannon/src/world/World';
import Plane from 'cannon/src/shapes/Plane';
import Box from 'cannon/src/shapes/Box';
import Body from 'cannon/src/objects/Body';
import Vec3 from 'cannon/src/math/Vec3';
import RaycastResult from 'cannon/src/collision/RaycastResult';

import { Vector3 } from 'three/src/math/Vector3';

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
    this.cRaycastOptions = {};
    this.cRaycastResult = new RaycastResult();
    this.cPosition = new Vec3();
    this.cNormal = new Vec3();
  }

  getBodyOfObject(object) {
    if(object != null) {
      return this.objectToBody[object.uuid];
    }
    return null;
  }

  getObjectOfBody(body) {
    if(body != null) {
      return this.bodyToObject[body.id];
    }
    return null;
  }

  raycastClosest(from, to, result = new PhysicsRaycastResult()) {
    let hit = this.world.raycastClosest(from, to, this.cRaycastOptions, this.cRaycastResult);
    this.normalizeRaycastResult(this.cRaycastResult, result);
    return hit;
  }

  applyImpulse(object, position, normal) {
    let body = this.getBodyOfObject(object);
    if(body != null) {
      this.cPosition.copy(position);
      this.cNormal.copy(normal);
      body.applyImpulse(this.cNormal, this.cPosition);
    }
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

  normalizeRaycastResult(cannonResult, physicsResult) {
    physicsResult.hit = cannonResult.hasHit;
    physicsResult.object = this.getObjectOfBody(cannonResult.body);
    physicsResult.normal.copy(cannonResult.hitNormalWorld);
    physicsResult.position.copy(cannonResult.hitPointWorld);
    physicsResult.distance = cannonResult.distance;
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

export class PhysicsRaycastResult {
  hit = false
  object = null
  position = new Vector3()
  normal = new Vector3()
  distance = -1
}