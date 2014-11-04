precision mediump float;

uniform int activeIdx;
uniform sampler2D base;

varying float att;
varying float idx;
varying vec2 tc;
varying vec2 lmtc;

void main() {
  int current = int(idx);
  vec3 select = activeIdx==current 
  	? vec3(1,0.5,0.2) 
  	: vec3(1,1,1);
  vec3 color = texture2D(base, tc).rgb * select;
  float c = step(fract(lmtc.x*64.0), 0.5) + step(fract(lmtc.y*64.0), 0.5);
  c = c == 2.0 || c == 0.0 ? 0.2 : 0.8;
  gl_FragColor = vec4(/*color * att*/c, c, c, 1.0);
}