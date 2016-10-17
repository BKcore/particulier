import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  GridHelper
} from 'three';

import OrbitControls from '../libs/three/OrbitControls.js'

class App {
  constructor(opts) {
    this.width = opts.width | 1280;
    this.height = opts.height | 720;
    this.pixelRatio = opts.pixelRatio | 1;
    this.aspectRatio = this.width / this.height;
    this.near = opts.near | 1;
    this.far = opts.far | 1000;
    this.fov = opts.fov | 90;
    this.dom = opts.dom;
    this.time = performance.now();

    this.initRenderer();
    this.initCamera();
    this.initScene();
    this.initListeners();

    requestAnimationFrame(this.onRequestAnimationFrame);
  }

  onWindowResize = () => {
    this.width = window.innerWidth;
    this.height = window.innerHeight
    this.aspectRatio = this.width / this.height;
    this.camera.aspect = this.aspectRatio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  onRequestAnimationFrame = () => {
    requestAnimationFrame(this.onRequestAnimationFrame);
    let now = performance.now();
    let dt = now - this.time;
    this.time = now;
    this.tick(dt);
  }

  initListeners() {
    window.addEventListener('resize', this.onWindowResize, false);
  }

  initRenderer() {
    this.renderer = new WebGLRenderer();
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x222222);
    this.dom.appendChild(this.renderer.domElement);
  }

  initCamera() {
    this.camera = new PerspectiveCamera(this.fov, this.aspectRatio, this.near, this.far);
    this.camera.position.y = 100;
    this.camera.position.z = -200;
    this.cameraControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.cameraControls.enableDamping = true;
    this.cameraControls.dampingFactor = 0.25;
    this.cameraControls.enableZoom = false;
  }

  initScene() {
    this.scene = new Scene();
    this.grid = new GridHelper(200, 40, 0x0000ff, 0x808080);
    this.grid.position.y = 0;
    this.scene.add(this.grid);
  }

  tick(dt) {
    this.cameraControls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

let config = {
  dom: window.document.body,
  pixelRatio: window.devicePixelRatio,
  width: window.innerWidth,
  height: window.innerHeight
};
let app = new App(config);
