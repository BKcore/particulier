import { AmbientLight } from 'three/src/lights/AmbientLight';
import { BoxGeometry } from 'three/src/geometries/BoxGeometry';
import { CameraHelper } from 'three/src/extras/helpers/CameraHelper';
import { DirectionalLight } from 'three/src/lights/DirectionalLight';
import { FogExp2 } from 'three/src/scenes/FogExp2';
import { GridHelper } from 'three/src/extras/helpers/GridHelper';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { PCFSoftShadowMap, ReinhardToneMapping, RepeatWrapping } from 'three/src/constants';
import { Scene } from 'three/src/scenes/Scene';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';

import { OrbitControls } from '../libs/three/OrbitControls.js';
import { Sky } from '../libs/three/SkyShader.js';

import { ParticleSystem, ParticleEmitter } from './particulier.js';
import { GrayBox } from './GrayBox.js';
import { FirstPersonPlayer } from './FirstPersonPlayer.js';
import { Loader } from './Loader.js';

const ASSETS = [
  {path: '/textures/default.png', type: 'texture'},
  {path: '/models/gun.json', type: 'json/model'}
]

class App {
  constructor(opts) {
    this.assetsPath = opts.assetsPath || '';
    this.width = opts.width || 1280;
    this.height = opts.height || 720;
    this.pixelRatio = opts.pixelRatio || 1;
    this.renderRatio = 0.75;
    this.aspectRatio = this.width / this.height;
    this.near = opts.near || 0.1;
    this.far = opts.far || 1000;
    this.fov = opts.fov || 80;
    this.dom = opts.dom;
    this.time = performance.now() * 0.001;
    this.boxes = [];
    this.camera = null;

    this.loader = new Loader(this.assetsPath);
    this.loader.loadAssets(ASSETS, this.onLoadComplete, this.onLoadProgress, this.onLoadError);

    this.sunPosition = new Vector3();
    if(opts.sunPosition != null) {
      this.sunPosition.fromArray(opts.sunPosition).normalize().multiplyScalar(50);
    }
  }

  onWindowResize = () => {
    this.width = window.innerWidth;
    this.height = window.innerHeight
    this.aspectRatio = this.width / this.height;
    this.camera.aspect = this.aspectRatio;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.player.onWindowResize();
  }

  onRequestAnimationFrame = () => {
    requestAnimationFrame(this.onRequestAnimationFrame);
    let now = performance.now() * 0.001;
    let dt = now - this.time;
    this.time = now;
    this.tick(dt);
  }

  onLoadProgress = (loaded, failed, total, path, asset, error) => {
    console.info('Loading:', loaded + failed, '/', total, path, asset, error);
  }

  onLoadError = (error) => {
    console.error(error.toString(), error.stack);
  }

  onLoadComplete = () => {
    GrayBox.setDefaultTexture(this.loader.getAsset('/textures/default.png').texture);
    this.initRenderer();
    this.initCamera();
    this.initScene();
    this.initPlayer();
    this.initListeners();
    requestAnimationFrame(this.onRequestAnimationFrame);
  }

  onMouseDown = () => {
    if(this.camera === this.player.camera) {
      this.pointerLock(true);
    }
  }

  toggleCamera() {
    if(this.camera === this.orbitCamera) {
      this.camera = this.player.camera;
      this.pointerLock(true);
    } else {
      this.camera = this.orbitCamera;
      this.pointerLock(false);
    }
    this.onWindowResize();
  }

  pointerLock(enable) {
    if(enable) {
      this.dom.requestPointerLock();
    } else {
      window.document.exitPointerLock();
    }
  }

  initListeners() {
    window.addEventListener('resize', this.onWindowResize, false);
    this.dom.addEventListener('mousedown', this.onMouseDown, false);
  }

  initRenderer() {
    this.renderer = new WebGLRenderer();
    this.renderer.setPixelRatio(this.pixelRatio * this.renderRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0x222222);
    this.renderer.extensions.get('ANGLE_instanced_arrays');
    this.renderer.autoClear = false;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.toneMapping = ReinhardToneMapping;
    this.dom.appendChild(this.renderer.domElement);
  }

  initPlayer() {
    this.player = new FirstPersonPlayer(this);
    this.camera = this.player.camera;
    this.scene.add(this.player);
    // this.cameraHelper = new CameraHelper(this.player.camera);
    // this.scene.add(this.cameraHelper);
  }

  initCamera() {
    this.orbitCamera = new PerspectiveCamera(this.fov, this.aspectRatio, this.near, this.far);
    this.orbitCamera.position.set(-2, 1.8, -2);
    this.cameraControls = new OrbitControls(this.orbitCamera, this.renderer.domElement);
    this.cameraControls.enableDamping = true;
    this.cameraControls.dampingFactor = 0.25;
    this.cameraControls.enableZoom = true;
  }

  initScene() {
    this.scene = new Scene();
    this.scene.fog = new FogExp2(0x818f9c, 0.0022);
    this.initLighting();
    // this.grid = new GridHelper(200, 40, 0x0000ff, 0x444444);
    // this.grid.position.y = 0;
    // this.scene.add(this.grid);
    this.ground = GrayBox.createBox(0, -5, 0, 1000, 10, 1000);
    this.ground.frustumCulled = false;
    this.scene.add(this.ground);
    this.addBoxes();
    this.particleSystem = new ParticleSystem({maxCount: 100000});
    this.scene.add(this.particleSystem.getContainer().getMesh());
    this.particleEmitter = new ParticleEmitter(this.particleSystem);
  }

  initLighting() {
    this.sky = new Sky({
      turbidity: 11,
      rayleigh: 0.6,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.645,
      luminance: 1.1,
      sunPosition: this.sunPosition
    });
    this.scene.add(this.sky.mesh);
    this.ambient = new AmbientLight(0xfdefff, 1.6);
    this.scene.add(this.ambient);
    this.sun = new DirectionalLight(0xfffdef, 1.2);
    this.sun.position.copy(this.sunPosition);
    this.sun.castShadow = true;
    let shadow = this.sun.shadow;
    shadow.mapSize.width = 2048;
    shadow.mapSize.height = 2048;
    let d = 10;
    shadow.camera.left = -d;
    shadow.camera.right = d;
    shadow.camera.top = d;
    shadow.camera.bottom = -d;
    shadow.camera.near = 1;
    shadow.camera.far = 200;
    shadow.bias = -0.000001;
    this.scene.add(this.sun);
    // this.shadowCameraHelper = new CameraHelper(shadow.camera);
    // this.scene.add(this.shadowCameraHelper);
  }

  addBoxes() {
    let boxes = [
      [-2, 0.5, 6, 1, 1, 1],
      [0, 1, 6, 2, 2, 2],
      [4, 1.5, 6, 3, 3, 3],
      [-2, 0.5, -6, 1, 1, 1, 0xffffff],
      [0, 1, -6, 2, 2, 2, 0x6c6c6c],
      [4, 1.5, -6, 3, 3, 3, 0x000000]
    ];
    for(let args of boxes) {
      let box = GrayBox.createBox.apply(null, args);
      this.scene.add(box);
      this.boxes.push(box);
    }
  }

  tick(dt) {
    this.player.tick(dt);
    this.sky.mesh.position.copy(this.player.position);
    if(this.camera === this.orbitCamera) {
      this.cameraControls.update();
    }
    let position = this.particleEmitter.getContainer().getObject().position;
    position.x = Math.cos(this.time) * 100;
    position.z = Math.sin(this.time) * 100;
    this.particleEmitter.spawnMany(100);
    this.particleSystem.tick(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

let config = {
  assetsPath: window.ASSET_PATH || '',
  dom: window.document.body,
  pixelRatio: window.devicePixelRatio,
  width: window.innerWidth,
  height: window.innerHeight,
  sunPosition: [2, 6, 10]
};
let app = new App(config);
