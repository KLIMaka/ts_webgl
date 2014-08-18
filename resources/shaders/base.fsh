precision mediump float;

uniform int activeIdx;
uniform sampler2D base;

varying float att;
varying float idx;
varying vec2 tc;

void main() {
  int current = int(idx);
  vec3 select = activeIdx==current 
  	? vec3(1,0.5,0.2) 
  	: vec3(1,1,1);
  vec3 color = texture2D(base, tc).rgb * select;

  gl_FragColor = vec4(color * att, 1.0);
}