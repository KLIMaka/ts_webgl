precision mediump float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;
uniform int pluN;
uniform vec4 color;
uniform vec3 curpos;

varying float lightLevel;
varying vec2 tc;
varying vec3 wpos;

const float trans = float(255.0/256.0);
const float totalPLUs = 15.0;
const float lightLevels = 64.0;


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
  if (distance(wpos.xz, curpos.xz) < 8.0)
    c *= 4.0;
#endif

  gl_FragColor = vec4(color * c);
}
