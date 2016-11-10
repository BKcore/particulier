import World from 'cannon/src/world/World';
import Plane from 'cannon/src/shapes/Plane';
import Box from 'cannon/src/shapes/Box';
import Sphere from 'cannon/src/shapes/Sphere';
import Cylinder from 'cannon/src/shapes/Cylinder';
import Body from 'cannon/src/objects/Body';
import Material from 'cannon/src/material/Material';
import ContactMaterial from 'cannon/src/material/ContactMaterial';
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
    this.cDirection = new Vec3();
    this.materials = {
      static: new Material('static'),
      player: new Material('player'),
      dynamic: new Material('dynamic')
    }
    this.world.addContactMaterial(new ContactMaterial(
      this.materials.static, this.materials.player, {friction: 0.0, restitution: 0.0}
    ));
    this.world.addContactMaterial(new ContactMaterial(
      this.materials.dynamic, this.materials.player, {friction: 0.0, restitution: 0.0}
    ));
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

  applyImpulse(object, position, direction) {
    let body = this.getBodyOfObject(object);
    if(body != null) {
      this.cPosition.copy(position);
      this.cDirection.copy(direction);
      body.applyImpulse(this.cDirection, this.cPosition);
    }
  }

  applyForce(object, position, direction) {
    let body = this.getBodyOfObject(object);
    if(body != null) {
      this.cPosition.copy(position);
      this.cDirection.copy(normal);
      body.applyForce(this.cDirection, this.cPosition);
    }
  }

  setGroundVelocity(object, velocity) {
    let body = this.getBodyOfObject(object);
    if(body != null) {
      body.velocity.x = velocity.x;
      body.velocity.z = velocity.z;
    }
  }

  createPlayerBody(object, height, radius, mass) {
    let shape = new Cylinder(radius, radius, height, 8);
    let body = new Body({mass: mass, material: this.materials.player, fixedRotation: true});
    body.addShape(shape);
    this.registerAndBind(body, object, true);
    body.quaternion.setFromAxisAngle(new Vec3(1, 0, 0), -Math.PI/2);
    body.linearDamping = 0;
    return body;
  }

  createBoxBody(object, sx, sy, sz, mass = 1) {
    let shape = new Box(new Vec3(sx / 2, sy / 2, sz / 2));
    return this.createBody(object, shape, mass);
  }

  createBody(object, shape, mass = 1) {
    let dynamic = mass > 0;
    let material = dynamic ? this.materials.dynamic : this.materials.static;
    let body = new Body({mass: mass, material: material});
    body.addShape(shape);
    this.registerAndBind(body, object, dynamic);
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
      if(object.physicsUpdateRotation !== false) {
        object.quaternion.copy(body.quaternion);
      }
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