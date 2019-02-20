precision mediump float;

uniform sampler2D base;
uniform int currentId;
uniform vec4 color;

varying float att;
varying vec2 tc;

#ifdef SELECT
const float c = 256.0/255.0;

void main() {
  if (texture2D(base, fract(tc)).a == 0.0)
    discard;
    
  float cf = float(currentId) / 256.0;
  float r = fract(cf);
  cf = (cf - r) / 256.0;
  float g = fract(cf);
  cf = (cf - g) / 256.0;
  float b = fract(cf);
  gl_FragColor = vec4(r*c, g*c, b*c, 1.0);
}

#else

void main() {
#ifdef FLAT
  vec4 c = vec4(1.0);
#else
  vec4 t = texture2D(base, fract(tc));
  vec4 c = vec4(t.rgb * att, t.a);
#endif

#ifdef TC_GRID 
  if (fract(tc.x) < 0.01 || fract(tc.x) > 0.99 ||
  	  fract(tc.y) < 0.01 || fract(tc.y) > 0.99)
   	c = vec4(2.0);
#endif

  if (c.a == 0.0)
    discard;
  gl_FragColor = vec4(color * c);
}

#endif

