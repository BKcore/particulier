import { InstancedBufferGeometry } from 'three/src/core/InstancedBufferGeometry';
import { InstancedBufferAttribute } from 'three/src/core/InstancedBufferAttribute';
import { InstancedInterleavedBuffer } from 'three/src/core/InstancedInterleavedBuffer';
import { InterleavedBufferAttribute } from 'three/src/core/InterleavedBufferAttribute';
import { InterleavedBuffer } from 'three/src/core/InterleavedBuffer';
import { BufferAttribute } from 'three/src/core/BufferAttribute';
import { Object3D } from 'three/src/core/Object3D';
import { Points } from 'three/src/objects/Points';
import { Mesh } from 'three/src/objects/Mesh';
import { RawShaderMaterial } from 'three/src/materials/RawShaderMaterial';
import { DoubleSide, AdditiveBlending } from 'three/src/constants';
import { Vector3 } from 'three/src/math/Vector3';

import {
  vec4,
  vec3,
  vec2
} from 'gl-matrix'

import {
  copyVec2At,
  copyVec3At,
  copyVec4At,
  randomInRange,
  randomInRange4,
  setVec2At,
  setVec4At,
  setVec6At
} from './Utils.js'

import vertexShader from './shaders/test.vert.glsl';
import fragmentShader from './shaders/test.frag.glsl';

export const ParticleType = {
  POINT: 'POINT',
  QUAD: 'QUAD'
}

class ThreeParticleSystemContainer {

  constructor(type, count, Particle, _instanceBuffer) {
    this.geometry = new InstancedBufferGeometry();
    this.vertexBuffer = new InterleavedBuffer(Particle.getVertexBuffer(), Particle.vertexStride);
    this.instanceBuffer = new InstancedInterleavedBuffer(_instanceBuffer, Particle.instanceStride);
    this.instanceBuffer.setDynamic(true);

    for(let {name, size, offset} of Particle.vertexAttr) {
      this.geometry.addAttribute(name,
        new InterleavedBufferAttribute(this.vertexBuffer, size, offset));
    }

    for(let {name, size, offset} of Particle.instanceAttr) {
      this.geometry.addAttribute(name,
        new InterleavedBufferAttribute(this.instanceBuffer, size, offset));
    }

    this.geometry.setIndex(new BufferAttribute(Particle.getIndexBuffer(), 1));
    this.material = this.createMaterial();

    if(type === ParticleType.POINT) {
      this.mesh = new Points(this.geometry, this.material);
    } else if(type === ParticleType.QUAD) {
      this.mesh = new Mesh(this.geometry, this.material);
    }
    // Temp
    this.mesh.frustumCulled = false;
  }

  getMesh() { return this.mesh; }

  setForce(x, y, z) {
    this.material.uniforms.force.value.set(x, y, z);
  }

  setScreenSpaceCrossVector(x, y, z) {
    this.material.uniforms.ssCrossVector.value.set(x, y, z);
  }

  createMaterial() {
    return new RawShaderMaterial({
      uniforms: {
        force: {value: new Vector3(0, 0, 0)},
        time: {value: 0},
        ssCrossVector: {value: new Vector3(0, 0, 1)}
      },
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      side: DoubleSide,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: true,
      depthWrite: false
    });
  }

  updateBuffer() {
    this.instanceBuffer.needsUpdate = true;
  }

  updateTime(time) {
    this.material.uniforms.time.value = time;
  }
}

class ThreeParticleEmitterContainer {

  constructor() {
    this.object3D = new Object3D();
  }

  getObject() { return this.object3D; }

  setPosition(position) {
    this.object3D.position.fromArray(position);
  }
}

export class ThreeParticleBackend {

  static getParticleSystemContainerClass() { return ThreeParticleSystemContainer; }
  static getParticleEmitterContainerClass() { return ThreeParticleEmitterContainer; }
}

class QuadParticle {

  static vertexCount = 4;
  static vertexStride = 2;
  static vertexAttr = [
    {name: 'uv', size: 2, offset: 0}
  ];
  static instanceStride = 16;
  static instanceAttr = [
    {name: 'position', size: 4, offset: 0},
    {name: 'velocity', size: 4, offset: 4},
    {name: 'color', size: 4, offset: 8},
    {name: 'scale', size: 2, offset: 12},
    {name: 'life', size: 2, offset: 14}
  ];

  static getVertexBuffer() {
    let buffer = new Float32Array(QuadParticle.vertexCount * QuadParticle.vertexStride);
    setVec4At(buffer, 0, -1, -1, -1, 1);
    setVec4At(buffer, 4, 1, 1, 1, -1);
    return buffer;
  }

  static getIndexBuffer() {
    let buffer = new Uint16Array(6);
    setVec6At(buffer, 0, 0, 2, 1, 0, 3, 2);
    return buffer;
  }

  static init(buffer, offset, time, {position, velocity, color, scale, life}) {
    let i = offset * QuadParticle.instanceStride;
    copyVec3At(buffer, i, position);
    copyVec3At(buffer, i + 4, velocity, 0);
    copyVec4At(buffer, i + 8, color);
    copyVec2At(buffer, i + 12, scale);
    setVec2At(buffer, i + 14, time, life);
  }

  static reset(buffer, offset) {
    let i = offset * QuadParticle.instanceStride;
    setVec4At(buffer, i, -9e9, -9e9, -9e9, 0);
    setVec4At(buffer, i + 4, 0, 0, 0, 0);
    setVec4At(buffer, i + 8, 0, 0, 0, 0);
    setVec4At(buffer, i + 12, 0, 0, 0, -1);
  }
}

export class ParticleSystem {

  static backend = ThreeParticleBackend;

  constructor(opts) {
    this.next = 0;
    this.time = 0.0;
    this.maxCount = opts.maxCount;
    this.debug = opts.debug;
    let Particle = this.ParticleHandler = QuadParticle;

    this.instanceBuffer = new Float32Array(Particle.instanceStride * this.maxCount);
    for(let i = 0; i < this.maxCount; ++i) {
      Particle.reset(this.instanceBuffer, i);
    }

    let Container = ParticleSystem.backend.getParticleSystemContainerClass();
    this.container = new Container(ParticleType.QUAD, this.maxCount, Particle, this.instanceBuffer);

    if(opts.force != null) {
      let [x, y, z] = opts.force;
      this.setForce(x, y, z);
    }
  }

  getContainer() { return this.container; }

  setForce(x, y, z) {
    this.container.setForce(x, y, z);
  }

  setScreenSpaceCrossVector(x, y, z) {
    this.container.setScreenSpaceCrossVector(x, y, z);
  }

  tick(dt) {
    this.time += dt;
    this.container.updateTime(this.time);
    if(!this.needsUpdate) { return; }
    this.container.updateBuffer();
    this.needsUpdate = false;
  }

  getNext() {
    let next = this.next;
    this.next = (next + 1) % this.maxCount;
    return next;
  }

  spawn(initialProperties) {
    let next = this.getNext();
    let Particle = this.ParticleHandler;
    Particle.init(this.instanceBuffer, next, this.time, initialProperties);
    if(this.debug) {
      console.log('Spawn:', next, this.time, initialProperties, this.instanceBuffer);
    }
    this.needsUpdate = true;
  }
}

export class ParticleEmitter {

  static backend = ThreeParticleBackend;

  constructor(particleSystem) {
    this.particleSystem = particleSystem;
    this.initialProperties = {
      position: vec3.fromValues(0, 0, 0),
      velocity: vec3.fromValues(0, 0, 0),
      color: vec4.fromValues(1, 1, 1, 1),
      scale: vec2.fromValues(0.3, 0.3),
      life: 3
    };
    this.position = vec3.create();
    this.offsetRange = [vec3.fromValues(0, 0, 0), vec3.fromValues(0, 0, 0)];
    this.velocityRange = [vec3.fromValues(-10, 20, -10), vec3.fromValues(10, 40, 10)];
    this.colorRange = [vec4.fromValues(1, 1, 1, 1), vec4.fromValues(1, 1, 1, 1)];
    this.lastUpdate = -Infinity;
    let Container = ParticleEmitter.backend.getParticleEmitterContainerClass();
    this.container = new Container();
  }

  getContainer() { return this.container; }

  setPosition(x, y, z) {
    vec3.set(this.position, x, y, z);
  }

  setOffsetRange(x0, y0, z0, x1, y1, z1) {
    vec3.set(this.offsetRange[0], x0, y0, z0);
    vec3.set(this.offsetRange[1], x1, y1, z1);
  }

  setColorRange(r0, g0, b0, a0, r1, g1, b1, a1) {
    vec4.set(this.colorRange[0], r0, g0, b0, a0);
    vec4.set(this.colorRange[1], r1, g1, b1, a1);
  }

  setVelocity(x, y, z) {
    vec3.set(this.velocityRange[0], x, y, z);
    vec3.set(this.velocityRange[1], x, y, z);
  }

  setScale(x, y) {
    vec2.set(this.initialProperties.scale, x, y);
  }

  setLife(life) {
    this.initialProperties.life = life;
  }

  maybeUpdate() {
    if(this.lastUpdate >= this.particleSystem.time) { return; }
    this.lastUpdate = this.particleSystem.time;
    this.container.setPosition(this.position);
  }

  spawnOne() {
    this.maybeUpdate();
    let {position, velocity, color, scale} = this.initialProperties;
    randomInRange(position, this.offsetRange[0], this.offsetRange[1]);
    vec3.add(position, position, this.position);
    randomInRange(velocity, this.velocityRange[0], this.velocityRange[1]);
    randomInRange4(color, this.colorRange[0], this.colorRange[1]);
    this.particleSystem.spawn(this.initialProperties);
  }

  spawnMany(count) {
    for(let i = 0; i < count; ++i) {
      this.spawnOne();
    }
  }
}


export class ParticleWorld {

  constructor(addHook) {
    this.systems = [];
    this.addHook = addHook ? addHook : (x => x);
  }

  tick(dt) {
    for(let system of this.systems) {
      system.tick(dt);
    }
  }

  add(system) {
    this.systems.push(system);
    this.addHook(system);
  }

  remove(system) {
    let i = this.systems.indexOf(system);
    if(i >= 0) {
      this.systems.splice(i, 1);
    }
  }
}