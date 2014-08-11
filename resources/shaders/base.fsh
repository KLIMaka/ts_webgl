precision mediump float;

uniform int activeIdx;

varying float att;
varying float idx;

void main() {
  int current = int(idx);
  vec3 color = activeIdx==current 
  	? vec3(1,0.5,0.2) 
  	: vec3(0.2,0.5,1);

  gl_FragColor = vec4(color * att, 1.0);
}