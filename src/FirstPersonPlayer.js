import { CameraHelper } from 'three/src/extras/helpers/CameraHelper';
import { Object3D } from 'three/src/core/Object3D';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { Vector3 } from 'three/src/math/Vector3';
import { Vector2 } from 'three/src/math/Vector2';
import { GrayBox } from './GrayBox.js';

const KMPH_TO_MPS = 1000 / 3600;
const VANGLE_MIN = Math.PI/12;
const VANGLE_MAX = Math.PI - Math.PI/12;

export class FirstPersonPlayer extends Object3D {
  constructor(app) {
    super();
    this.app = app;
    this.frameMotion = new Vector3();
    this.orientation = new Vector2(0, Math.PI / 2);
    this.target = new Vector3();
    this.sensitivity = 2.5;
    this.keys = {
      forward: 0,
      back: 0,
      left: 0,
      right: 0,
      run: 0
    };
    this.walkSpeed = 10 * KMPH_TO_MPS;
    this.runSpeed = 20 * KMPH_TO_MPS;
    this.pixelRatio = new Vector2();
    this.onWindowResize();
    this.head = new Object3D();
    this.head.position.set(0, 1.7, 0);
    this.add(this.head);

    this.camera = new PerspectiveCamera(app.fov, app.aspectRatio, app.near, app.far);
    this.camera.position.set(0, 0, 0);
    this.head.add(this.camera);
    this.addGun();

    this.initListeners();
  }

  addGun() {
    let geometry = this.app.loader.getAsset('/models/gun.json').geometry;
    let material = GrayBox.createMaterial(20, 20);
    this.gun = GrayBox.createMesh(geometry, material, 0.12, -0.1, -0.28, 0.19, 0.19, 0.19);
    this.gun.castShadow = false;
    this.gun.receiveShadow = false;
    this.gun.rotation.set(-Math.PI/2, 0, Math.PI);
    this.head.add(this.gun);
  }

  tick(dt) {
    this.frameMotion.set(0, 0, 0);

    this.frameMotion.z -= this.keys.forward;
    this.frameMotion.z += this.keys.back;
    this.frameMotion.x -= this.keys.left;
    this.frameMotion.x += this.keys.right;
    let speed = this.walkSpeed;
    if(this.keys.run) { speed = this.runSpeed; }

    this.frameMotion.normalize().transformDirection(this.matrix).multiplyScalar(speed * dt);
    this.position.add(this.frameMotion);

    this.target.x = this.head.position.x + 100 * Math.sin(this.orientation.y) * Math.cos(Math.PI / 2);
    this.target.y = this.head.position.y + 100 * Math.cos(this.orientation.y);
    this.target.z = this.head.position.z + 100 * Math.sin(this.orientation.y);
    this.head.lookAt(this.target);

    let hangle = this.orientation.x + Math.PI/2;
    this.target.x = this.position.x + 100 * Math.cos(this.orientation.x);
    this.target.y = this.position.y + 100 * Math.cos(Math.PI / 2);
    this.target.z = this.position.z + 100 * Math.sin(this.orientation.x);
    this.lookAt(this.target);
  }

  initListeners() {
    window.addEventListener('keydown', this.onKeyDown, false);
    window.addEventListener('keyup', this.onKeyUp, false);
    window.addEventListener('mousemove', this.onMouseMove, false);
  }

  onWindowResize() {
    this.pixelRatio.set(this.sensitivity / window.innerWidth, this.sensitivity / window.innerHeight);
  }

  onMouseMove = (event) => {
    let {movementX, movementY} = event;
    this.orientation.x += movementX * this.pixelRatio.x;
    this.orientation.y -= movementY * this.pixelRatio.y;
    this.orientation.y = Math.max(Math.min(this.orientation.y, VANGLE_MAX), VANGLE_MIN);
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
      case 16: /*run*/ this.keys.run = 1; break;
      case 221: /*]*/ this.app.toggleCamera();
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
      case 16: /*run*/ this.keys.run = 0; break;
    }
  }
}
