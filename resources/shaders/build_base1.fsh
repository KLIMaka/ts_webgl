precision mediump float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;
uniform int pluN;
uniform vec4 color;
uniform vec3 curpos;
uniform int shade;
uniform vec3 eyepos;

varying float lightLevel;
varying vec2 tc;
varying vec3 wpos;

const float trans = float(255.0/256.0);
const float totalPLUs = 15.0;

float lightOffset() {
  float lightLevel = length(wpos.xz - eyepos.xz) / 1024.0;
  return clamp(float(shade) + lightLevel, 0.5, 63.5) / 64.0;
}

vec4 palLookup() {
  float palIdx = texture2D(base, fract(tc)).r;
  if (palIdx >= trans)
    discard;
  float pluU = palIdx;
#ifdef PAL_LIGHTING
  float pluV = (float(pluN) + lightOffset()) / totalPLUs;
#else
  float pluV = float(pluN) / totalPLUs + 0.001;
#endif
  float pluIdx = texture2D(plu, vec2(pluU, pluV)).r;
  vec3 c = texture2D(pal, vec2(pluIdx, 0)).rgb;
#ifdef PAL_LIGHTING
  return vec4(c , 1.0);
#else
  return vec4(c * (1.0 - lightOffset()), 1.0);
#endif
}

void main() {
#ifdef FLAT
  vec4 c = vec4(1.0);
#else
  vec4 c = palLookup();
#endif

  if (color.r > 1.0 && any(lessThan(fract(tc*8.0), vec2(0.04, 0.04))))
    c *= 2.0;

#ifdef TC_GRID 
  if (distance(wpos.xz, curpos.xz) < 16.0)
    c *= 4.0;
#endif

  gl_FragColor = vec4(color * c);
}
