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
uniform vec4 clipPlane;

varying float lightLevel;
varying vec2 tc;
varying vec3 wpos;
varying vec3 wnormal;

const float trans = float(255.0/256.0);
const float totalPLUs = 15.0;
const float PI = 3.1415926538;

float lightOffset() {
  float lightLevel = length(wpos.xz - eyepos.xz) / 1024.0;
  return clamp(float(shade) + lightLevel, 0.5, 63.5) / 64.0;
}

vec3 palLookup(vec2 tc) {
  float palIdx = texture2D(base, fract(tc)).r;
  if (palIdx >= trans)
    discard;

  int activePal = pluN;
  float lightLevel = lightOffset();
  vec3 toLight = normalize(curpos - wpos);

#ifdef SPECULAR
  vec3 r = reflect(-toLight, wnormal);
  float specular = pow(dot(r, normalize(eyepos-wpos)), 100.0);
  lightLevel = clamp(lightLevel - specular, 0.5/64.0, 63.5/64.0);
#endif

  float dist = distance(wpos, curpos);
  if (dist < 2048.0 && dot(wnormal, toLight) >= 0.0) {
    lightLevel = clamp(lightLevel - pow(1.0-(dist / 2048.0), 2.0), 0.5/64.0, 63.5/64.0);
  }

  float pluU = palIdx;
#ifdef PAL_LIGHTING
  float pluV = (float(activePal) + lightLevel) / totalPLUs;
#else
  float pluV = float(activePal) / totalPLUs + 0.001;
#endif
  float pluIdx = texture2D(plu, vec2(pluU, pluV)).r;
  vec3 c = texture2D(pal, vec2(pluIdx, 0)).rgb;
#ifdef PAL_LIGHTING
  return c;
#else
  return c * (1.0 - lightLevel);
#endif
}

void clip() {
  if (dot(wpos, clipPlane.xyz) + clipPlane.w > 0.0)
    discard;
}

void main() {
  clip();
#ifdef FLAT
  vec3 c = vec3(1.0);
#else
#ifdef PARALLAX
  vec3 toPixel = normalize(wpos - eyepos);
  float hang = (atan(toPixel.z, toPixel.x) + PI) / (2.0 * PI);
  float vang = (1.0 - toPixel.y) / 2.0;
  vec3 c = palLookup(vec2(hang, vang));
#else
  vec3 c = palLookup(tc);
#endif
#endif

  if (color.r > 1.0 && any(lessThan(fract(tc*8.0), vec2(0.04, 0.04))))
    c *= 2.0;

  gl_FragColor = vec4(vec3(color.rgb * c), color.a);
}
