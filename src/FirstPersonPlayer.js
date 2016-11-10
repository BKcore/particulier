import { CameraHelper } from 'three/src/extras/helpers/CameraHelper';
import { Object3D } from 'three/src/core/Object3D';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { Euler } from 'three/src/math/Euler';
import { Vector3 } from 'three/src/math/Vector3';
import { Vector2 } from 'three/src/math/Vector2';
import { AdditiveBlending } from 'three/src/constants';
import { GrayBox } from './GrayBox.js';
import { fInterpTo } from './Utils.js';
import { _Math } from 'three/src/math/Math';
let { smootherstep, lerp } = _Math;

import { PhysicsRaycastResult, G_STATIC, G_DYNAMIC } from './Physics.js';

const KMPH_TO_MPS = 1000 / 3600;
const VANGLE_MIN = -Math.PI/2 + Math.PI/12;
const VANGLE_MAX = +Math.PI/2 - Math.PI/12;

const EPSYLON = 1e-6;

const ADS_TIME = 0.14;
const FOV_ADS_MUL = 0.8;
const ANGLE_LAG_SMOOTH_TIME = 0.1;
const STRAFE_ROLL_SMOOTH_TIME = 0.2;
const RUN_SMOOTH_TIME = 0.16;
const MOVE_SMOOTH_TIME = 0.1;
const STOP_SMOOTH_TIME = 0.2;
const FIRE_COOLDOWN = 0.5;
const FIRE_KICK_FORCE = 0.6;
const FIRE_KICK_TIME = 0.05;
const FIRE_RAYCAST_RANGE = 1000;
const FIRE_INPULSE_FORCE = 12;

const JUMP_COOLDOWN = 0.2;
const JUMP_FORCE = 8;
let JUMP_IMPULSE = new Vector3(0, 1, -0.1).normalize();

const RETICLE_SIDES_OPACITY = 0.6;
const RETICLE_SCALE = 0.1;

const PLAYER_HEIGHT = 2.0;
const PLAYER_RADIUS = 0.6;

let GUN_POS = new Vector3(0.12, -0.11, -0.28);
let GUN_POS_ADS = new Vector3(0.0, -0.092, -0.28);
let GUN_POS_RUN = new Vector3(0.1, -0.07, -0.30);
let FIRE_IMPULSE_OFFSET = new Vector3(0, 0.5, 0);

export class FirstPersonPlayer extends Object3D {
  constructor(app) {
    super();
    this.physicsUpdateRotation = false;
    this.app = app;
    this.tmpVec3 = new Vector3();
    this.frameMotion = new Vector3();
    this.frameAngle = new Vector2();
    this.orientation = new Vector2(0, Math.PI / 2);
    this.target = new Vector3();
    this.sensitivity = 2.5;
    this.smoothLocalFrameAngle = new Vector2();
    this.smoothLocalFrameMotion = new Vector3();
    this.smoothRun = 0;
    this.smoothMove = 0;
    this.smoothAim = 0;
    this.smoothCooldown = 0;
    this.keys = {
      forward: 0,
      back: 0,
      left: 0,
      right: 0,
      run: 0,
      aim: 0,
      jump: 0
    };
    this.aimTiming = 0;
    this.jumpTiming = 0;
    this.fireTiming = 0;
    this.walkSpeed = 7.5 * KMPH_TO_MPS;
    this.runSpeed = 15 * KMPH_TO_MPS;
    this.dampenSpeed = 80 * KMPH_TO_MPS;
    this.pixelRatio = new Vector2();
    this.onWindowResize();
    this.head = new Object3D();
    this.headRotation = new Euler(0, 0, 0);
    this.headPosition = new Vector3(0, 0.8, 0);
    this.head.position.copy(this.headPosition);
    this.add(this.head);
    this.gunRotation = new Euler(-Math.PI/2, 0, Math.PI);

    this.impulse = new Vector3();
    this.aimRay = {
      from: new Vector3(),
      to: new Vector3(),
      dir: new Vector3()
    }
    this.aimRayNeedsUpdate = true;
    this.raycastResult = new PhysicsRaycastResult();

    this.position.set(0, 2, 0);

    this.camera = new PerspectiveCamera(app.fov, app.aspectRatio, app.near, app.far);
    this.camera.position.set(0, 0, 0);
    this.head.add(this.camera);
    this.addGun();

    this.app.physics.createPlayerBody(this, PLAYER_HEIGHT, PLAYER_RADIUS, 80);

    this.initListeners();
  }

  addGun() {
    let geometry = this.app.loader.getAsset('/models/gun/gun.json').geometry;
    let material = GrayBox.createPBRMaterial({
      map: this.app.loader.getAsset('/models/gun/gun.albedo.jpg').texture,
      aoMap: this.app.loader.getAsset('/models/gun/gun.ao.jpg').texture,
      roughnessMap: this.app.loader.getAsset('/models/gun/gun.roughness.jpg').texture,
      metalnessMap: this.app.loader.getAsset('/models/gun/gun.metalness.jpg').texture,
      envMap: this.app.getCubeMap(),
      roughness: 1,
      metalness: 1
    });
    let {x, y, z} = GUN_POS;
    this.gun = GrayBox.createMesh(geometry, material, x, y, z, 0.19, 0.19, 0.19);
    this.gun.castShadow = false;
    this.gun.receiveShadow = false;
    this.gun.rotation.copy(this.gunRotation);
    this.head.add(this.gun);
    let centerTex = this.app.loader.getAsset('/textures/reticle.default.center.png').texture;
    let sidesTex = this.app.loader.getAsset('/textures/reticle.default.sides.png').texture;
    let s = RETICLE_SCALE;
    let centerReticle = GrayBox.createSprite(centerTex, 0, 0, -1, s, s, s);
    let sidesReticle = GrayBox.createSprite(sidesTex, 0, 0, -1, s, s, s);
    this.reticles = [centerReticle, sidesReticle];
    for(let ret of this.reticles) {
      ret.material.depthTest = false;
      ret.material.depthWrite = false;
      ret.material.blending = AdditiveBlending;
      this.camera.add(ret);
    }
  }

  tick(dt) {
    this.frameMotion.set(0, 0, 0);

    this.frameMotion.z -= this.keys.forward;
    this.frameMotion.z += this.keys.back;
    this.frameMotion.x -= this.keys.left;
    this.frameMotion.x += this.keys.right;
    this.frameMotion.normalize();

    let hasMotion = (this.frameMotion.z != 0 || this.frameMotion.x != 0);

    if(!hasMotion) {
      // Cancel Run if no motion.
      this.run(false);
      this.smoothMove = lerp(this.smoothMove, 0, dt / STOP_SMOOTH_TIME);
    } else {
      this.smoothMove = lerp(this.smoothMove, 1, dt / MOVE_SMOOTH_TIME);
    }
    let speed = this.walkSpeed;
    if(this.keys.run) {
      speed = this.runSpeed;
    }
    speed *= dt;

    // Save and smooth local motion and orientation for later
    let localFrameMotion = this.tmpVec3;
    localFrameMotion.copy(this.frameMotion).multiplyScalar(speed);
    localFrameMotion.copy(this.frameMotion).multiplyScalar(speed);
    this.smoothLocalFrameMotion.lerp(localFrameMotion, dt / STRAFE_ROLL_SMOOTH_TIME);
    this.smoothLocalFrameAngle.lerp(this.frameAngle, dt / ANGLE_LAG_SMOOTH_TIME);
    this.smoothRun = fInterpTo(this.smoothRun, this.keys.run, 1 / RUN_SMOOTH_TIME, dt);

    // Apply motion
    // Transform motion to world space
    this.frameMotion.transformDirection(this.matrix).multiplyScalar(speed * 100);
    // this.position.add(this.frameMotion);
    // this.app.physics.setGroundVelocity(this, this.frameMotion);
    // this.app.physics.addVelocity(this, this.frameMotion);
    let body = this.app.physics.getBodyOfObject(this);
    if(hasMotion) {
      body.velocity.x = this.frameMotion.x;
      body.velocity.z = this.frameMotion.z;
    } else {
      body.velocity.x = fInterpTo(body.velocity.x, 0, this.dampenSpeed, dt);
      body.velocity.z = fInterpTo(body.velocity.z, 0, this.dampenSpeed, dt);
    }

    this.head.position.copy(this.headPosition);
    this.head.rotation.copy(this.headRotation);

    // Apply orientation
    // Vertical angle on the head
    this.head.rotation.x = this.orientation.x;
    // Horizontal angle on the body
    this.rotation.y = this.orientation.y;

    // Reset gun rotation and position
    this.gun.rotation.copy(this.gunRotation);
    this.gun.position.copy(GUN_POS);

    this.aimRayNeedsUpdate = true;

    this.tickJump(dt);
    this.tickAim(dt);
    this.tickWobble(dt);
    this.tickFire(dt);
    this.tickReticles(dt);

    this.camera.updateProjectionMatrix();
  }

  tickJump(dt) {
    if(this.jumpTiming > 0.0) {
      this.jumpTiming -= dt;
      this.jumpTiming = Math.max(this.jumpTiming, 0);
    }
    else if(this.keys.jump) {
      this.jumpTiming = JUMP_COOLDOWN;
      this.impulse.copy(JUMP_IMPULSE).transformDirection(this.matrix).multiplyScalar(JUMP_FORCE);
      // this.app.physics.addVelocity(this, this.impulse);
    }
  }

  tickAim(dt) {
    if(this.aimTiming < 1 && this.keys.aim) {
      this.aimTiming += dt / ADS_TIME;
    } else if(this.aimTiming > 0 && !this.keys.aim) {
      this.aimTiming -= dt / ADS_TIME;
    }
    this.smoothAim = smootherstep(this.aimTiming, 0, 1);
    this.gun.position.lerpVectors(GUN_POS, GUN_POS_ADS, this.smoothAim);
    this.gun.position.lerp(GUN_POS_RUN, this.smoothRun);
    this.camera.fov = lerp(this.app.fov, this.app.fov * FOV_ADS_MUL, this.smoothAim);
  }

  tickWobble(dt) {
    // Motion wobble
    let walkWobbleX = Math.cos(this.app.time * 6.0) * 0.005;
    let runWobbleX = Math.cos(this.app.time * 10.0) * 0.008;
    let breathWobbleX = 0;
    let walkWobbleY = Math.cos(this.app.time * 12.0) * 0.003;
    let runWobbleY = Math.cos(this.app.time * 20.0) * 0.006;
    let breathWobbleY = Math.sin(this.app.time * 2.0) * 0.002;

    let aimWobbleAttenuation = 1.0 - this.smoothAim * 0.8;
    let wobbleX = aimWobbleAttenuation * lerp(breathWobbleX,
                  lerp(walkWobbleX, runWobbleX, this.smoothRun), this.smoothMove);
    let wobbleY = aimWobbleAttenuation * lerp(breathWobbleY,
                  lerp(walkWobbleY, runWobbleY, this.smoothRun), this.smoothMove);

    this.camera.position.y = wobbleY;
    this.camera.position.x = wobbleX;
    this.head.position.x += wobbleX * 2;
    this.head.position.y += wobbleY * 2;

    // Aim wobble+lag
    this.gun.position.x += this.smoothLocalFrameAngle.y * 0.1;
    this.gun.rotation.x += this.smoothLocalFrameAngle.x * 0.5 // Vertical
                        + wobbleY * 1
                        + this.smoothRun * 0.7; // Run rotation
    this.gun.rotation.z += this.smoothLocalFrameAngle.y * 0.5 // Horizontal
                        - wobbleX * 3
                        + this.smoothRun * 0.15; // Run rotation
    // Roll when strafing
    this.gun.rotation.y += this.smoothLocalFrameMotion.x * 1; // Roll
  }

  tickFire(dt) {
    if(this.fireTiming > 0.0) {
      this.fireTiming -= dt;
      this.fireTiming = Math.max(this.fireTiming, 0);
    }
    else if(this.keys.fire && !this.smoothRun) {
      this.fireTiming = FIRE_COOLDOWN;
      this.orientation.x += FIRE_KICK_FORCE * 0.03;
      this.orientation.y -= FIRE_KICK_FORCE * 0.01;
      this.doFireAction();
    }
    // TODO: Really need custom curves for these...
    let kickTime = FIRE_COOLDOWN - FIRE_KICK_TIME;
    if(this.fireTiming > kickTime) {
      this.smoothCooldown = (1 - smootherstep(this.fireTiming, kickTime, FIRE_COOLDOWN));
    } else {
      this.smoothCooldown = smootherstep(this.fireTiming, 0, kickTime);
    }
    let kick = this.smoothCooldown * FIRE_KICK_FORCE;
    this.gun.position.x += 0.04 * kick;
    this.gun.position.y += 0.08 * kick;
    this.gun.position.z += 0.12 * kick;
    this.gun.rotation.x += 0.6 * kick;
    this.gun.rotation.y += 0.3 * kick;
    this.head.rotation.x += 0.15 * kick;
    this.camera.fov += 5 * kick;
  }

  tickReticles(dt) {
    let baseOpacity = 1.0 - Math.max(this.smoothAim, this.smoothRun);
    let fireOpacity = 1.0 - Math.min(this.fireTiming / 0.1, 1);
    this.reticles[0].material.opacity = baseOpacity * fireOpacity;
    this.reticles[1].material.opacity = baseOpacity * RETICLE_SIDES_OPACITY * (1 - this.smoothCooldown);
    this.reticles[1].scale.setScalar(RETICLE_SCALE * (1 + this.smoothCooldown));
  }

  toggleRun() {
    this.run(!this.keys.run);
  }

  run(enable) {
    if(!enable) {
      this.keys.run = 0;
    } else if(!this.keys.aim) {
      this.fire(false);
      this.keys.run = 1;
    }
  }

  aim(enable) {
    this.keys.aim = enable ? 1 : 0;
    if(enable) {
      this.run(false);
    }
  }

  jump(enable) {
    this.keys.jump = enable ? 1 : 0;
    if(enable) {
      this.aim(false);
    }
  }

  fire(enable) {
    this.keys.fire = enable ? 1 : 0;
    if(enable) {
      this.run(false);
    }
  }

  getAimRay() {
    if(this.aimRayNeedsUpdate) {
      this.camera.getWorldPosition(this.aimRay.from);
      this.camera.getWorldDirection(this.aimRay.dir);
      this.aimRay.to.copy(this.aimRay.dir).multiplyScalar(FIRE_RAYCAST_RANGE).add(this.aimRay.from);
    }
    return this.aimRay;
  }

  doFireAction() {
    // TODO: VFX
    let ray = this.getAimRay();
    let hit = this.app.physics.raycastClosest(ray.from, ray.to, this.raycastResult, G_DYNAMIC | G_STATIC);
    if(hit) {
      let {object, position} = this.raycastResult;
      this.impulse.copy(ray.dir).add(FIRE_IMPULSE_OFFSET).multiplyScalar(FIRE_INPULSE_FORCE);
      this.app.physics.applyImpulse(object, position, this.impulse);
    }
  }

  initListeners() {
    window.addEventListener('keydown', this.onKeyDown, false);
    window.addEventListener('keyup', this.onKeyUp, false);
    window.addEventListener('mousemove', this.onMouseMove, false);
    window.addEventListener('mousedown', this.onMouseDown, false);
    window.addEventListener('mouseup', this.onMouseUp, false);
  }

  onWindowResize() {
    this.pixelRatio.set(this.sensitivity / window.innerWidth, this.sensitivity / window.innerHeight);
  }

  onMouseMove = (event) => {
    let {movementX, movementY} = event;
    this.frameAngle.x = movementY * this.pixelRatio.y;
    this.frameAngle.y = movementX * this.pixelRatio.x;
    this.orientation.sub(this.frameAngle);
    this.orientation.x = Math.max(Math.min(this.orientation.x, VANGLE_MAX), VANGLE_MIN);
  }

  onMouseDown = (event) => {
    switch(event.button) {
      case 0: this.fire(true); break;
      case 2: this.aim(true); break;
    }
  }

  onMouseUp = (event) => {
    switch(event.button) {
      case 0: this.fire(false); break;
      case 2: this.aim(false); break;
    }
  }

  onKeyDown = (event) => {
    switch(event.keyCode) {
      case 38: /*up*/
      case 87: /*W*/ this.keys.forward = 1; break;
      case 37: /*left*/
      case 65: /*A*/ this.keys.left = 1; break;
      case 40: /*down*/
      case 83: /*S*/ this.keys.back = 1; break;
      case 39: /*right*/
      case 68: /*D*/ this.keys.right = 1; break;
      case 16: /*run*/ this.toggleRun(); break;
      case 221: /*]*/ this.app.toggleCamera(); break;
      case 17: /*control*/ this.aim(true); break;
      case 32: /*space*/ this.jump(true); break;
    }
  }

  onKeyUp = (event) => {
    switch(event.keyCode) {
      case 38: /*up*/
      case 87: /*W*/ this.keys.forward = 0; break;
      case 37: /*left*/
      case 65: /*A*/ this.keys.left = 0; break;
      case 40: /*down*/
      case 83: /*S*/ this.keys.back = 0; break;
      case 39: /*right*/
      case 68: /*D*/ this.keys.right = 0; break;
      case 17: /*control*/ this.aim(false); break;
      case 32: /*space*/ this.jump(false); break;
    }
  }
}
