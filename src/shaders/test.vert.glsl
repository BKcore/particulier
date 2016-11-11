precision highp float;

uniform mat4 modelViewMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
uniform vec3 force;
uniform float time;
uniform vec3 ssCrossVector;

attribute vec4 position;
attribute vec4 velocity;
attribute vec4 color;
attribute vec2 uv;
attribute vec2 scale;
attribute vec2 life;

varying vec2 vUv;
varying vec4 vColor;

const vec2 velocityStretchIntensity = vec2(0.0, 0.05);
const vec2 quadPivot = vec2(0.0, 0.0);

vec4 expandQuad(vec4 pos, vec3 vel) {
  vec2 size = scale;
  size *= 1.0 + length(vel) * velocityStretchIntensity;
  vec2 amount = (uv - quadPivot) * size;

  vec3 ncross = normalize((viewMatrix * vec4(vel, 0.0)).xyz);
  vec3 nright = cross(ssCrossVector, ncross);

  return vec4(pos.xyz + amount.x * nright + amount.y * ncross, 1.0);
}

void main() {
  vec4 pos = vec4(position.xyz, 1.0);
  float age = (time - life.x);
  // Auto-kill
  pos.xyz -= 999999.0 * step(life.y, age);
  pos.xyz += velocity.xyz * age + force * age * age;
  pos = expandQuad(modelViewMatrix * pos, velocity.xyz + force * age * age);
  vUv = uv;
  vColor = color;
  gl_Position = projectionMatrix * pos;
}
