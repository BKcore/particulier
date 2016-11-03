import { CameraHelper } from 'three/src/extras/helpers/CameraHelper';
import { Object3D } from 'three/src/core/Object3D';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { Vector3 } from 'three/src/math/Vector3';
import { Vector2 } from 'three/src/math/Vector2';
import { GrayBox } from './GrayBox.js';
import { _Math } from 'three/src/math/Math';
let { smootherstep, lerp } = _Math;

const KMPH_TO_MPS = 1000 / 3600;
const VANGLE_MIN = -Math.PI/2 + Math.PI/12;
const VANGLE_MAX = +Math.PI/2 - Math.PI/12;

const ADS_TIME = 0.14;
const FOV_ADS_MUL = 0.8;
const ANGLE_LAG_SMOOTH_TIME = 0.1;
const STRAFE_ROLL_SMOOTH_TIME = 0.2;
const RUN_SMOOTH_TIME = 0.08;
const MOVE_SMOOTH_TIME = 0.1;
const STOP_SMOOTH_TIME = 0.2;

let GUN_POS = new Vector3(0.12, -0.11, -0.28);
let GUN_POS_ADS = new Vector3(0.0, -0.092, -0.28);
let GUN_POS_RUN = new Vector3(0.1, -0.07, -0.30);

export class FirstPersonPlayer extends Object3D {
  constructor(app) {
    super();
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
    this.keys = {
      forward: 0,
      back: 0,
      left: 0,
      right: 0,
      run: 0,
      aim: 0
    };
    this.aimTiming = 0;
    this.walkSpeed = 10 * KMPH_TO_MPS;
    this.runSpeed = 20 * KMPH_TO_MPS;
    this.pixelRatio = new Vector2();
    this.onWindowResize();
    this.head = new Object3D();
    this.headPosition = new Vector3(0, 1.7, 0);
    this.head.position.copy(this.headPosition);
    this.add(this.head);
    this.gunRotation = new Vector3(-Math.PI/2, 0, Math.PI);

    this.camera = new PerspectiveCamera(app.fov, app.aspectRatio, app.near, app.far);
    this.camera.position.set(0, 0, 0);
    this.head.add(this.camera);
    this.addGun();

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
    this.gun.rotation.setFromVector3(this.gunRotation);
    this.head.add(this.gun);
  }

  tick(dt) {
    this.frameMotion.set(0, 0, 0);

    this.frameMotion.z -= this.keys.forward;
    this.frameMotion.z += this.keys.back;
    this.frameMotion.x -= this.keys.left;
    this.frameMotion.x += this.keys.right;
    this.frameMotion.normalize()

    if(this.frameMotion.z == 0 && this.frameMotion.x == 0) {
      // Cancel Run if no motion.
      if(this.keys.run) {
        this.toggleRun();
      }
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
    this.smoothLocalFrameMotion.lerp(localFrameMotion, dt / STRAFE_ROLL_SMOOTH_TIME);
    this.smoothLocalFrameAngle.lerp(this.frameAngle, dt / ANGLE_LAG_SMOOTH_TIME);
    this.smoothRun = lerp(this.smoothRun, this.keys.run, dt / RUN_SMOOTH_TIME);

    // Apply motion
    // Transform motion to world space
    this.frameMotion.transformDirection(this.matrix).multiplyScalar(speed);
    this.position.add(this.frameMotion);

    // Apply orientation
    // Vertical angle on the head
    this.head.rotation.x = this.orientation.x;
    // Horizontal angle on the body
    this.rotation.y = this.orientation.y;

    this.tickAim(dt);
    this.tickWobble(dt);
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
    this.camera.updateProjectionMatrix();
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
    this.head.position.x = this.headPosition.x + wobbleX * 2;
    this.head.position.y = this.headPosition.y + wobbleY * 2;

    // Aim wobble+lag
    this.gun.position.x += this.smoothLocalFrameAngle.y * 0.1;
    this.gun.rotation.x = this.gunRotation.x + this.smoothLocalFrameAngle.x * 0.5 // Vertical
                        + wobbleY * 1
                        + this.smoothRun * 0.7; // Run rotation
    this.gun.rotation.z = this.gunRotation.z + this.smoothLocalFrameAngle.y * 0.5 // Horizontal
                        - wobbleX * 3
                        + this.smoothRun * 0.15; // Run rotation
    // Roll when strafing
    this.gun.rotation.y = this.gunRotation.y + this.smoothLocalFrameMotion.x * 1; // Roll
  }

  toggleRun() {
    if(this.keys.run) {
      this.keys.run = 0;
    } else if(!this.keys.aim) {
      this.keys.run = 1;
    }
  }

  aim(enable) {
    this.keys.aim = enable ? 1 : 0;
    if(enable && this.keys.run) {
      this.toggleRun();
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
      case 0: this.keys.fire = 1; break;
      case 2: this.aim(true); break;
    }
  }

  onMouseUp = (event) => {
    switch(event.button) {
      case 0: this.keys.fire = 0; break;
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
    }
  }
}
