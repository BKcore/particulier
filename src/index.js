import { AmbientLight } from 'three/src/lights/AmbientLight';
import { BoxGeometry } from 'three/src/geometries/BoxGeometry';
import { CameraHelper } from 'three/src/extras/helpers/CameraHelper';
import { CubeCamera } from 'three/src/cameras/CubeCamera';
import { DirectionalLight } from 'three/src/lights/DirectionalLight';
import { FogExp2 } from 'three/src/scenes/FogExp2';
import { GridHelper } from 'three/src/extras/helpers/GridHelper';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import {
  PCFSoftShadowMap, ReinhardToneMapping, Uncharted2ToneMapping, RepeatWrapping
} from 'three/src/constants';
import { Scene } from 'three/src/scenes/Scene';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';

import { OrbitControls } from '../libs/three/OrbitControls.js';
import { Sky } from '../libs/three/SkyShader.js';

import { ParticleWorld, ParticleSystem, ParticleEmitter } from './particulier.js';
import { GrayBox } from './GrayBox.js';
import { FirstPersonPlayer } from './FirstPersonPlayer.js';
import { Loader } from './Loader.js';
import { Physics } from './Physics.js';

import { randomInRange } from './Utils.js';

const ASSETS = [
  {path: '/textures/default.png', type: 'texture'},
  {path: '/models/gun/gun.json', type: 'json/model'},
  {path: '/models/gun/gun.albedo.jpg', type: 'texture'},
  {path: '/models/gun/gun.ao.jpg', type: 'texture'},
  {path: '/models/gun/gun.normal.jpg', type: 'texture'},
  {path: '/models/gun/gun.roughness.jpg', type: 'texture'},
  {path: '/models/gun/gun.metalness.jpg', type: 'texture'},
  {path: '/textures/reticle.default.png', type: 'texture'},
  {path: '/textures/reticle.default.center.png', type: 'texture'},
  {path: '/textures/reticle.default.sides.png', type: 'texture'}
]

class App {
  constructor(opts) {
    window.app = this.app;
    this.assetsPath = opts.assetsPath || '';
    this.width = opts.width || 1280;
    this.height = opts.height || 720;
    this.pixelRatio = opts.pixelRatio || 1;
    this.renderRatio = this.pixelRatio > 1 ? 0.75 : 1;
    this.aspectRatio = this.width / this.height;
    this.near = opts.near || 0.01;
    this.far = opts.far || 1000;
    this.fov = opts.fov || 80;
    this.dom = opts.dom;
    this.time = performance.now() * 0.001;
    this.lastTime = this.time;
    this.boxes = [];
    this.camera = null;

    this.createPreloader();

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
    let dt = Math.min(1/10, now - this.lastTime);
    this.lastTime = now;
    this.time += dt
    this.tick(dt);
  }

  onLoadProgress = (loaded, failed, total, path, asset, error) => {
    console.info('Loading:', loaded + failed, '/', total, path, asset, error);
    this.updatePreloader((loaded + failed) / total);
  }

  onLoadError = (error) => {
    console.error(error.toString(), error.stack);
  }

  onLoadComplete = () => {
    GrayBox.setDefaultTexture(this.loader.getAsset('/textures/default.png').texture);
    this.initPhysics();
    this.initRenderer();
    this.initCamera();
    this.initScene();
    this.initPlayer();
    this.initListeners();
    requestAnimationFrame(this.onRequestAnimationFrame);
    this.removePreloader();
  }

  onMouseDown = () => {
    if(this.camera === this.player.camera) {
      this.pointerLock(true);
    }
  }

  createPreloader() {
    this.preloader = document.createElement('div');
    this.preloader.style.fontSize = 32;
    this.preloader.style.fontFamily = 'Monospace';
    this.preloader.style.color = 'gray';
    this.preloader.style.textAlign = 'center';
    this.preloader.style.position = 'absolute';
    this.preloader.style.top = '40%';
    this.preloader.style.left = 0;
    this.preloader.style.right = 0;
    this.preloader.textContent = 'Loading... 0%';
    document.body.appendChild(this.preloader);
  }

  removePreloader() {
    this.preloader.remove();
  }

  updatePreloader(progress) {
    console.log('update', progress);
    this.preloader.textContent = `Loading... ${Math.floor(progress * 100)}%`;
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

  initPhysics() {
    this.physics = new Physics();
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
    this.renderer.toneMapping = Uncharted2ToneMapping;
    this.renderer.toneMappingExposure = 1.6;
    this.dom.appendChild(this.renderer.domElement);
  }

  initCubeMap() {
    this.cubeCamera = new CubeCamera(this.near, this.far, 256);
    this.cubeCamera.position.y = 1.4;
    this.scene.add(this.cubeCamera);
    this.cubeCamera.updateCubeMap(this.renderer, this.scene);
    GrayBox.setDefaultEnvMap(this.getCubeMap());
  }

  getCubeMap() {
    if(this.cubeCamera != null) {
      return this.cubeCamera.renderTarget.texture;
    } else {
      return null;
    }
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
    this.particleWorld = new ParticleWorld((system) => this.scene.add(system.getContainer().getMesh()));
    this.scene.fog = new FogExp2(0x818f9c, 0.0022);
    this.initLighting();
    this.addGround();
    // Generate CubeMap before adding dynamic objects.
    this.initCubeMap();
    this.addBoxes();
    this.addSpheres();
    this.addPhysicsBoxes();
    this.particleSystem = new ParticleSystem({maxCount: 100000, force: [0, -10, 0]});
    this.particleWorld.add(this.particleSystem);
    this.particleEmitter = new ParticleEmitter(this.particleSystem);
    this.particleEmitter.setOffsetRange(-1, 0, -1, 1, 0, 1);
    this.particleEmitter.setColorRange(0, 0.5, 1, 0.3, 0, 1, 1, 0.4);
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
    this.sun = new DirectionalLight(0xfffdef, 1.0);
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

  addGround() {
    this.ground = GrayBox.createBox(0, -5, 0, 1000, 10, 1000);
    this.ground.frustumCulled = false;
    this.scene.add(this.ground);
    let {x, y, z} = this.ground.scale;
    this.physics.createBoxBody(this.ground, x, y, z, 0);
    // this.physics.createGroundBody(this.ground);
  }

  addPhysicsBoxes() {
    let pi2 = Math.PI * 2;
    let positionRange = [[-4, 4, -4], [4, 8, 4]];
    let rotationRange = [[0, 0, 0], [pi2, pi2, pi2]];
    let p = [0, 0, 0];
    let r = [0, 0, 0];
    for(let i = 0; i < 20; ++i) {
      randomInRange(p, positionRange[0], positionRange[1]);
      randomInRange(r, rotationRange[0], rotationRange[1]);
      let s = 0.5 + Math.random() * 0.5 - 0.25;
      let box = GrayBox.createBox(p[0], p[1], p[2], s, s, s, 0xff0000);
      box.material.metalness = 0.9;
      box.material.roughness = 0.3;
      box.rotation.fromArray(r);
      this.scene.add(box);
      this.physics.createBoxBody(box, s, s, s, 1);
    }
  }

  addBoxes() {
    let boxes = [
      [0, 0.6, 6, 6, 1.2, 0.6, 0xeeeeee],
      [0, 0.6, -12, 6, 1.2, 0.6, 0xeeeeee],
      [-5, 1.5, -6, 8, 3, 0.4],
      [5, 1.5, -6, 8, 3, 0.4],
    ];
    for(let args of boxes) {
      let box = GrayBox.createBox.apply(null, args);
      this.scene.add(box);
      this.boxes.push(box);
      this.physics.createBoxBody(box, args[3], args[4], args[5], 0);
    }
  }

  addSpheres() {
    this.spheres = [];
    let spheres = [
      [-6, 1.2, -2, 1, 1, 1, 0x999999, 0.9, 0.1],
      [-6, 1.2, 0, 1, 1, 1, 0x999999, 0.5, 0.1],
      [-6, 1.2, 2, 1, 1, 1, 0x999999, 0.1, 0.1],
      [-8, 1.2, -2, 1, 1, 1, 0x999999, 0.9, 0.1],
      [-8, 1.2, 0, 1, 1, 1, 0x999999, 0.9, 0.5],
      [-8, 1.2, 2, 1, 1, 1, 0x999999, 0.9, 0.9],
      [-10, 1.2, -2, 1, 1, 1, 0x000000, 0.9, 0.1],
      [-10, 1.2, 0, 1, 1, 1, 0x000000, 0.5, 0.1],
      [-10, 1.2, 2, 1, 1, 1, 0x000000, 0.1, 0.1],
      [-12, 1.2, -2, 1, 1, 1, 0x000000, 0.9, 0.1],
      [-12, 1.2, 0, 1, 1, 1, 0x000000, 0.9, 0.5],
      [-12, 1.2, 2, 1, 1, 1, 0x000000, 0.9, 0.9]
    ];
    for(let args of spheres) {
      let sphere = GrayBox.createSphere.apply(null, args);
      sphere.material.metalness = args[7];
      sphere.material.roughness = args[8];
      sphere.material.envMap = this.getCubeMap();
      this.scene.add(sphere);
      this.spheres.push(sphere);
    }
  }

  tick(dt) {
    this.player.tick(dt);
    this.physics.tick(dt);
    this.sky.mesh.position.copy(this.player.position);
    if(this.camera === this.orbitCamera) {
      this.cameraControls.update();
    }
    this.particleEmitter.setPosition(Math.cos(this.time) * 100, 0, Math.sin(this.time) * 100);
    this.particleEmitter.spawnMany(100);
    this.particleWorld.tick(dt);
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
