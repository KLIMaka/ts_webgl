precision mediump float;
uniform mat4 MVP;
uniform vec3 eyepos;
uniform mat4 texMat;
uniform int shade;

#ifdef SPRITE
uniform mat4 P;
uniform mat4 MV;
attribute vec3 aNorm;
#endif

attribute vec3 aPos;

varying float att;
varying vec2 tc;

void main() {

#ifdef SPRITE
  vec4 epos = MV * vec4(aPos, 1.0);
  epos.xy += aNorm.xy;
  gl_Position = P * epos;
  tc = (texMat * vec4(aNorm.x, aNorm.y, 0.0 , 1.0)).xy;
#else
  gl_Position = MVP * vec4(aPos, 1.0);
  tc = (texMat * vec4(aPos, 1.0)).xy;
#endif

  att = (( -float(shade) * 3.0 + 190.0) / 256.0);
  att -= length(aPos - eyepos) / (70.0 * 1024.0);
}
