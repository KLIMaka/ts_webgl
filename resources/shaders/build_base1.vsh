precision mediump float;

uniform mat4 P;
uniform mat4 V;
uniform mat4 IV;
// uniform mat4 T;
uniform mat4 GT;

attribute vec3 aNorm;
attribute vec3 aPos;
attribute vec2 aTc;

varying vec2 tc;
varying vec2 gridtc;
varying vec3 wpos;
varying vec3 wnormal;

void main() {
  wpos = aPos;
  tc = aTc;
#ifdef SPRITE
  vec3 p = aPos + vec3(0.0, aNorm.y, 0.0);
  vec4 epos = V * vec4(p, 1.0);
  epos.x += aNorm.x;
  
  // tc = (T * vec4(aNorm.x, aNorm.y, 0.0 , 1.0)).xy;
  wnormal = (IV * vec4(0.0, 0.0, 1.0, 0.0)).xyz;
  tc = aTc;
  gridtc = (GT * vec4(aNorm.x, aNorm.y, 0.0 , 1.0)).xy;
  gl_Position = P * epos;
#else
  // tc = (T * vec4(aPos, 1.0)).xy;
  wnormal = aNorm;
  gridtc = (GT * vec4(aPos, 1.0)).xy;
  gl_Position = P * V * vec4(aPos, 1.0);
#endif
}
