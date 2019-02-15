precision mediump float;
uniform mat4 P;
uniform mat4 V;
uniform mat4 T;
uniform vec3 eyepos;
uniform int shade;

#ifdef SPRITE
attribute vec3 aNorm;
#endif

attribute vec3 aPos;

varying float att;
varying vec2 tc;

void main() {

#ifdef SPRITE
  vec4 epos = V * vec4(aPos, 1.0);
  epos.xy += aNorm.xy;
  gl_Position = P * epos;
  tc = (T * vec4(aNorm.x, aNorm.y, 0.0 , 1.0)).xy;
#else
  gl_Position = P * V * vec4(aPos, 1.0);
  tc = (T * vec4(aPos, 1.0)).xy;
#endif

  att = (( -float(shade) * 3.0 + 190.0) / 256.0);
  att -= length(aPos - eyepos) / (70.0 * 1024.0);
}
