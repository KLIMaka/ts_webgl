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
  vec4 color = texture2D(base, tc);
  // float c = step(0.5, fract(lmtc.x*256.0)) + step(0.5, fract(lmtc.y*256.0));
  // c = c == 0.0 || c == 2.0 ? 0.8 : 1.0;
  if (color.a == 0.0)
    discard;

  gl_FragColor = vec4(color.rgb*att*select, color.a);
}