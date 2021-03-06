precision mediump float;

uniform int activeIdx;
uniform sampler2D base;
uniform sampler2D lm;

varying float att;
varying float idx;
varying vec2 tc;
varying vec2 lmtc;

void main() {
  int current = int(idx);
  vec3 select = activeIdx==current 
  	? vec3(1,0.5,0.2) 
  	: vec3(1,1,1);
  vec3 color = texture2D(lm, lmtc).rgb * att;
  // float c = step(0.5, fract(lmtc.x*256.0)) + step(0.5, fract(lmtc.y*256.0));
  // c = c == 0.0 || c == 2.0 ? 0.8 : 1.0;
  gl_FragColor = vec4(color, 1.0);
}