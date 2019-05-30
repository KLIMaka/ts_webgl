precision mediump float;

uniform sampler2D base;
uniform sampler2D pal;
uniform sampler2D plu;
uniform sampler2D noise;
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

vec3 palLookup() {
  float palIdx = texture2D(base, fract(tc)).r;
  if (palIdx >= trans)
    discard;
  float pluU = palIdx;
#ifdef PAL_LIGHTING
  float pluV = (float(pluN) + lightOffset()) / totalPLUs;
#else
  float pluV = float(pluN) / totalPLUs;
#endif
  float pluIdx = texture2D(plu, vec2(pluU, pluV)).r;
  vec3 c = texture2D(pal, vec2(pluIdx, 0)).rgb;
#ifdef PAL_LIGHTING
  return c;
#else
  return c * (1.0 - lightOffset());
#endif
}

void main() {
//  float n = texture2D(noise, gl_FragCoord.xy/16.0).r;
//  if (n > color.a)
//    discard;
#ifdef FLAT
  vec3 c = vec3(1.0);
#else
  vec3 c = palLookup();
#endif

  if (color.r > 1.0 && any(lessThan(fract(tc*8.0), vec2(0.04, 0.04))))
    c *= 2.0;

#ifdef TC_GRID 
  if (distance(wpos.xz, curpos.xz) < 16.0)
    c *= 4.0;
#endif

  gl_FragColor = vec4(vec3(color.rgb * c), color.a);
}
