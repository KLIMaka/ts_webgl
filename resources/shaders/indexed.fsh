precision mediump float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D overlay;

varying vec2 tc;

void main() {
  float idx = texture2D(base, tc).r;
  float oidx = texture2D(overlay, tc).r;
  vec3 color = texture2D(pal, vec2(idx, 0.5)).rgb;
  vec3 over = texture2D(pal, vec2(oidx, 0.5)).rgb;
  gl_FragColor = vec4(oidx == 0.0 ? color : over, 1.0);
}