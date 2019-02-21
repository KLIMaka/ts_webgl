precision mediump float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;
uniform int pluN;
uniform int currentId;
uniform vec4 color;

varying float lightLevel;
varying vec2 tc;

const float trans = float(255.0/256.0);
const float totalPLUs = 15.0;
const float lightLevels = 64.0;

#ifdef SELECT
const float c = 256.0/255.0;

void main() {
  if (texture2D(base, fract(tc)).r >= trans)
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
  float palIdx = texture2D(base, fract(tc)).r;
  if (palIdx >= trans)
    discard;
  float pluU = palIdx;
  float pluV = float(pluN) / totalPLUs + lightLevel / (lightLevels * totalPLUs);
  float pluIdx = texture2D(plu, vec2(pluU, pluV)).r;
  vec4 c = texture2D(pal, vec2(pluIdx, 0));
#endif

#ifdef TC_GRID 
  if (fract(tc.x) < 0.01 || fract(tc.x) > 0.99 ||
  	  fract(tc.y) < 0.01 || fract(tc.y) > 0.99)
   	c = vec4(2.0);
#endif

  gl_FragColor = vec4(color * c);
}

#endif

