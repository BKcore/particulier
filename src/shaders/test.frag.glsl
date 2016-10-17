precision highp float;

varying vec2 vUv;
varying vec4 vColor;

void main() {
  vec4 color = vColor;
  color.a *= 1.0 - length(vUv);
  gl_FragColor = color;
}
