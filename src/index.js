import { AmbientLight } from 'three/src/lights/AmbientLight';
import { BoxGeometry } from 'three/src/geometries/BoxGeometry';
import { DirectionalLight } from 'three/src/lights/DirectionalLight';
import { FogExp2 } from 'three/src/scenes/FogExp2';
import { GridHelper } from 'three/src/extras/helpers/GridHelper';
import { TextureLoader } from 'three/src/loaders/TextureLoader';
import { Mesh } from 'three/src/objects/Mesh';
import { MeshStandardMaterial } from 'three/src/materials/MeshStandardMaterial';
import { PerspectiveCamera } from 'three/src/cameras/PerspectiveCamera';
import { ReinhardToneMapping, RepeatWrapping } from 'three/src/constants';
import { Scene } from 'three/src/scenes/Scene';
import { Vector2 } from 'three/src/math/Vector2';
import { Vector3 } from 'three/src/math/Vector3';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer';

import { OrbitControls } from '../libs/three/OrbitControls.js';
import { Sky } from '../libs/three/SkyShader.js';

import { ParticleSystem, ParticleEmitter } from './particulier.js';

class App {
  constructor(opts) {
    this.assetsPath = opts.assetsPath || '';
    this.width = opts.width || 1280;
    this.height = opts.height || 720;
    this.pixelRatio = opts.pixelRatio || 1;
    this.aspectRatio = this.width / this.height;
    this.near = opts.near || 1;
    this.far = opts.far || 1000;
    this.fov = opts.fov || 80;
    this.dom = opts.dom;
    this.time = performance.now() * 0.001;

    this.textureLoader = new TextureLoader();

    this.sunPosition = new Vector3();
    if(opts.sunPosition != null) {
      this.sunPosition.fromArray(opts.sunPosition);
    }

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
    this.farCamera.aspect = this.aspectRatio;
    this.farCamera.updateProjectionMatrix();
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
    this.renderer.autoClear = false;
    this.renderer.physicallyCorrectLights = true;
    this.renderer.gammaInput = true;
    this.renderer.gammaOutput = true;
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = ReinhardToneMapping;
    this.dom.appendChild(this.renderer.domElement);
  }

  initCamera() {
    this.camera = new PerspectiveCamera(this.fov, this.aspectRatio, this.near, this.far);
    this.camera.position.y = 100;
    this.camera.position.z = -200;
    this.farCamera = new PerspectiveCamera(this.fov, this.aspectRatio, this.far, this.far + 500000);
    this.cameraControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.cameraControls.enableDamping = true;
    this.cameraControls.dampingFactor = 0.25;
    this.cameraControls.enableZoom = true;
  }

  initScene() {
    this.scene = new Scene();
    this.scene.fog = new FogExp2(0x818f9c, 0.0022);
    this.farScene = new Scene();
    this.sky = new Sky({
      turbidity: 11,
      rayleigh: 0.6,
      mieCoefficient: 0.005,
      mieDirectionalG: 0.645,
      luminance: 1.1,
      sunPosition: this.sunPosition
    });
    this.farScene.add(this.sky.mesh);
    this.ambient = new AmbientLight(0x666666);
    this.scene.add(this.ambient);
    this.sun = new DirectionalLight(0xfffdef, 1);
    this.sun.position.copy(this.sunPosition);
    this.scene.add(this.sun);
    // this.grid = new GridHelper(200, 40, 0x0000ff, 0x444444);
    // this.grid.position.y = 0;
    // this.scene.add(this.grid);
    this.ground = this.createGround();
    this.scene.add(this.ground);
    this.particleSystem = new ParticleSystem({maxCount: 100000});
    this.scene.add(this.particleSystem.getContainer().getMesh());
    this.particleEmitter = new ParticleEmitter(this.particleSystem);
  }

  createGround() {
    let geometry = new BoxGeometry(1, 1, 1);
    let material = new MeshStandardMaterial({color: 0x999999, specular: 0xcccccc});
    material.map = this.textureLoader.load(this.assetsPath + 'textures/default.png');
    material.map.wrapS = material.map.wrapT = RepeatWrapping;
    material.map.anisotropy = 4;
    material.map.repeat.set(100, 100);
    material.roughness = 0.5;
    let mesh = new Mesh(geometry, material);
    mesh.position.y = -5;
    mesh.scale.set(1000, 10, 1000);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  createMesh(geometry, color) {

  }

  tick(dt) {
    this.cameraControls.update();
    this.farCamera.position.copy(this.camera.position);
    this.farCamera.rotation.copy(this.camera.rotation);
    let position = this.particleEmitter.getContainer().getObject().position;
    position.x = Math.cos(this.time) * 100;
    position.z = Math.sin(this.time) * 100;
    this.particleEmitter.spawnMany(100);
    this.particleSystem.tick(dt);
    this.renderer.render(this.farScene, this.farCamera);
    this.renderer.render(this.scene, this.camera);
  }
}

let config = {
  assetsPath: window.ASSET_PATH || '',
  dom: window.document.body,
  pixelRatio: window.devicePixelRatio,
  width: window.innerWidth,
  height: window.innerHeight,
  sunPosition: [50, 600, 1000]
};
let app = new App(config);
