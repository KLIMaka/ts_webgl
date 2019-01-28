precision mediump float;

uniform sampler2D base;

varying float att;
varying vec2 tc;

int unpack (vec4 c) {
  return int(c.r*256.0) + int(c.g*256.0)*256 + int(c.b*256.0)*65536;
}

void main() {
  vec4 color = texture2D(base, tc);
//  if (fract(tc.x) < 0.01 || fract(tc.x) > 0.99 ||
//  	  fract(tc.y) < 0.01 || fract(tc.y) > 0.99)
//   	color = vec4(2.0);
  if (color.a == 0.0)
    discard;
  gl_FragColor = vec4(color.rgb*att, color.a);
}