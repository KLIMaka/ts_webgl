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
  vec3 color = texture2D(lm, lmtc).rgb;
  gl_FragColor = vec4(color, 1.0);
}