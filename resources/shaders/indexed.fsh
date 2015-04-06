precision mediump float;

uniform sampler2D base;
uniform sampler2D pal;

varying vec2 tc;

void main() {
  vec3 color = texture2D(pal, vec2(texture2D(base, tc).r, 0.5)).rgb;
  gl_FragColor = vec4(color, 1.0);
}