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

  createMaterial() {
    return new RawShaderMaterial({
      uniforms: {
        force: {value: new Vector3(0, -10, 0)},
        time: {value: 0}
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

  copyPosition(out) {
    let {x, y, z} = this.object3D.position;
    vec3.set(out, x, y, z);
  }
}

export class ThreeParticleBackend {

  static getParticleSystemContainerClass() { return ThreeParticleSystemContainer; }
  static getParticleEmitterContainerClass() { return ThreeParticleEmitterContainer; }
}

class Utils {

  static addScalar2(out, vec, scalar) {
    vec[0] += scalar;
    vec[1] += scalar;
  }

  static addScalar3(out, vec, scalar) {
    vec[0] += scalar;
    vec[1] += scalar;
    vec[2] += scalar;
  }

  static randomScaleOffset(out, scale, offset) {
    vec3.random(out, scale);
    Utils.addScalar3(out, out, offset);
  }

  static randomInRange(out, start, end) {
    out[0] = Math.random() * (end[0] - start[0]) + start[0];
    out[1] = Math.random() * (end[1] - start[1]) + start[1];
    out[2] = Math.random() * (end[2] - start[2]) + start[2];
  }

  static setVec2At(buffer, i, x, y) {
    buffer[i + 0] = x;
    buffer[i + 1] = y;
  }

  static setVec3At(buffer, i, x, y, z) {
    buffer[i + 0] = x;
    buffer[i + 1] = y;
    buffer[i + 2] = z;
  }

  static setVec4At(buffer, i, x, y, z, w) {
    buffer[i + 0] = x;
    buffer[i + 1] = y;
    buffer[i + 2] = z;
    buffer[i + 3] = w;
  }

  static setVec6At(buffer, i, x, y, z, w, u, v) {
    buffer[i + 0] = x;
    buffer[i + 1] = y;
    buffer[i + 2] = z;
    buffer[i + 3] = w;
    buffer[i + 4] = u;
    buffer[i + 5] = v;
  }

  static copyVec2At(buffer, i, v) {
    buffer[i + 0] = v[0];
    buffer[i + 1] = v[1];
  }

  static copyVec3At(buffer, i, v) {
    buffer[i + 0] = v[0];
    buffer[i + 1] = v[1];
    buffer[i + 2] = v[2];
  }

  static copyVec4At(buffer, i, v) {
    buffer[i + 0] = v[0];
    buffer[i + 1] = v[1];
    buffer[i + 2] = v[2];
    buffer[i + 3] = v[3];
  }
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
    Utils.setVec4At(buffer, 0, -1, -1, -1, 1);
    Utils.setVec4At(buffer, 4, 1, 1, 1, -1);
    return buffer;
  }

  static getIndexBuffer() {
    let buffer = new Uint16Array(6);
    Utils.setVec6At(buffer, 0, 0, 2, 1, 0, 3, 2);
    return buffer;
  }

  static init(buffer, offset, time, {position, velocity, color, scale, life}) {
    let i = offset * QuadParticle.instanceStride;
    Utils.copyVec3At(buffer, i, position);
    Utils.copyVec3At(buffer, i + 4, velocity, 0);
    Utils.copyVec4At(buffer, i + 8, color);
    Utils.copyVec2At(buffer, i + 12, scale);
    Utils.setVec2At(buffer, i + 14, time, life);
  }

  static reset(buffer, offset) {
    let i = offset * QuadParticle.instanceStride;
    Utils.setVec4At(buffer, i, -9e9, -9e9, -9e9, 0);
    Utils.setVec4At(buffer, i + 4, 0, 0, 0, 0);
    Utils.setVec4At(buffer, i + 8, 0, 0, 0, 0);
    Utils.setVec4At(buffer, i + 12, 0, 0, 0, -1);
  }
}

export class ParticleSystem {

  static backend = ThreeParticleBackend;

  constructor(opts) {
    this.next = 0;
    this.time = 0.0;
    this.maxCount = opts.maxCount;
    let Particle = this.ParticleHandler = QuadParticle;

    this.instanceBuffer = new Float32Array(Particle.instanceStride * this.maxCount);
    for(let i = 0; i < this.maxCount; ++i) {
      Particle.reset(this.instanceBuffer, i);
    }

    let Container = ParticleSystem.backend.getParticleSystemContainerClass();
    this.container = new Container(ParticleType.QUAD, this.maxCount, Particle, this.instanceBuffer);
  }

  getContainer() { return this.container; }

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
      color: vec4.fromValues(1, 1, 1, 0.3),
      scale: vec2.fromValues(0.3, 0.3),
      life: 1
    };
    this.position = vec3.create();
    this.positionRange = [vec3.fromValues(-1, 0, -1), vec3.fromValues(1, 0, 1)];
    this.velocityRange = [vec3.fromValues(-10, 20, -10), vec3.fromValues(10, 40, 10)];
    this.colorRange = [vec3.fromValues(0, 0.5, 1), vec3.fromValues(0, 1, 1)];
    this.lastUpdate = -Infinity;
    let Container = ParticleEmitter.backend.getParticleEmitterContainerClass();
    this.container = new Container();
  }

  getContainer() { return this.container; }

  maybeUpdate() {
    if(this.lastUpdate >= this.particleSystem.time) { return; }
    this.lastUpdate = this.particleSystem.time;
    this.container.copyPosition(this.position);
  }

  spawnOne() {
    this.maybeUpdate();
    let {position, velocity, color, scale} = this.initialProperties;
    Utils.randomInRange(position, this.positionRange[0], this.positionRange[1]);
    vec3.add(position, position, this.position);
    Utils.randomInRange(velocity, this.velocityRange[0], this.velocityRange[1]);
    Utils.randomInRange(color, this.colorRange[0], this.colorRange[1]);
    this.initialProperties.life = 3;
    this.particleSystem.spawn(this.initialProperties);
  }

  spawnMany(count) {
    for(let i = 0; i < count; ++i) {
      this.spawnOne();
    }
  }
}
