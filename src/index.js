import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';
import { Scene } from 'three/src/scenes/Scene';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { GridHelper } from 'three/src/extras/helpers/GridHelper';
import { OrbitControls } from '../libs/three/OrbitControls.js';

import { ParticleSystem, ParticleEmitter } from './particulier.js';

class App {
  constructor(opts) {
    this.width = opts.width || 1280;
    this.height = opts.height || 720;
    this.pixelRatio = opts.pixelRatio || 1;
    this.aspectRatio = this.width / this.height;
    this.near = opts.near || 1;
    this.far = opts.far || 1000;
    this.fov = opts.fov || 90;
    this.dom = opts.dom;
    this.time = performance.now() * 0.001;

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
    let now = performance.now() * 0.001;
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
    this.renderer.extensions.get('ANGLE_instanced_arrays');
    this.dom.appendChild(this.renderer.domElement);
  }

  initCamera() {
    this.camera = new PerspectiveCamera(this.fov, this.aspectRatio, this.near, this.far);
    this.camera.position.y = 100;
    this.camera.position.z = -200;
    this.cameraControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.cameraControls.enableDamping = true;
    this.cameraControls.dampingFactor = 0.25;
    this.cameraControls.enableZoom = true;
  }

  initScene() {
    this.scene = new Scene();
    window.scene = this.scene;
    this.grid = new GridHelper(200, 40, 0x0000ff, 0x444444);
    this.grid.position.y = 0;
    this.scene.add(this.grid);
    this.particleSystem = new ParticleSystem({maxCount: 100000});
    this.scene.add(this.particleSystem.getContainer().getMesh());
    this.particleEmitter = new ParticleEmitter(this.particleSystem);
  }

  tick(dt) {
    this.cameraControls.update();
    let position = this.particleEmitter.getContainer().getObject().position;
    position.x = Math.cos(this.time) * 100;
    position.z = Math.sin(this.time) * 100;
    this.particleEmitter.spawnMany(100);
    this.particleSystem.tick(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

requestAnimationFrame(() => {
  let config = {
    dom: window.document.body,
    pixelRatio: window.devicePixelRatio,
    width: window.innerWidth,
    height: window.innerHeight
  };
  let app = new App(config);
})
