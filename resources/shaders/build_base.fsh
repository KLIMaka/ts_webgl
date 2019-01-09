precision mediump float;

uniform int activeIdx;
uniform sampler2D base;

varying float att;
varying vec2 tc;
varying vec4 idx;

int unpack (vec4 c) {
  return int(c.r*256.0) + int(c.g*256.0)*256 + int(c.b*256.0)*65536;
}

void main() {
  int curIdx = unpack(idx);
  vec3 select = activeIdx == curIdx
  	? vec3(1,0.5,0.2) 
  	: vec3(1,1,1);
  vec4 color = texture2D(base, tc);
  // if (fract(tc.x) < 0.01 || fract(tc.x) > 0.99 ||
  // 	  fract(tc.y) < 0.01 || fract(tc.y) > 0.99)
  // 	select += vec3(2, 1, 1);
  if (color.a == 0.0)
    discard;
  gl_FragColor = vec4(color.rgb*att*select, color.a);
}