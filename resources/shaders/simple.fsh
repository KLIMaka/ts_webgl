precision mediump float;

uniform vec3 LIGHT_DIR;

varying vec2 tc;
varying vec3 normal;
varying vec3 toEye;

void main() {
  vec3 color = vec3(0.5+dot(normal, -LIGHT_DIR)/2.0);
  gl_FragColor = vec4(color, 1.0);
}