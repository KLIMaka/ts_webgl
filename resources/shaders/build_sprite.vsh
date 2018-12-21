uniform mat4 P;
uniform mat4 MV;
uniform vec3 eyepos;

attribute vec3 aNorm;
attribute vec3 aPos;
attribute vec4 aIdx;
attribute vec2 aTc;
attribute float aShade;

varying float att;
varying vec4 idx;
varying vec2 tc;

void main() {
  vec4 wpos = vec4(aPos, 1.0);
  vec4 epos = MV * wpos;
  epos.xy += aNorm.xy;
  gl_Position = P * epos;
  att = ((-aShade*3.0 + 190.0) / 256.0);
  att -= length(aPos - eyepos) / (70.0 * 1024.0);
  idx = aIdx;
  tc = aTc;
}