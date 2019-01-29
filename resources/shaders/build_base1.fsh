precision mediump float;

uniform sampler2D base;
uniform int selectedId;
uniform int currentId;

varying float att;
varying vec2 tc;

#ifdef SELECT
void main() {
  float cf = float(currentId);
  float r = mod(cf / (256.0),  1.0);
  float g = mod(cf / (256.0 * 256.0), 1.0);
  float b = mod(cf / (256.0 * 256.0 * 256.0), 1.0);
  gl_FragColor = vec4(r, g, b, 1.0);
}
#else

void main() {
  vec4 color = texture2D(base, tc);

  if (currentId == selectedId)
  	color *= vec4(2.0, 2.0, 2.0, 1.0);

#ifdef TC_GRID 
  if (fract(tc.x) < 0.01 || fract(tc.x) > 0.99 ||
  	  fract(tc.y) < 0.01 || fract(tc.y) > 0.99)
   	color = vec4(2.0);
#endif

  if (color.a == 0.0)
    discard;
  gl_FragColor = vec4(color.rgb*att, color.a);
}

#endif