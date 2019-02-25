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

varying float lightLevel;
varying vec2 tc;

void main() {

#ifdef SPRITE
  vec3 p = aPos + vec3(0.0, aNorm.y, 0.0);
  vec4 epos = V * vec4(p, 1.0);
  epos.x += aNorm.x;
  gl_Position = P * epos;
  tc = (T * vec4(aNorm.x, aNorm.y, 0.0 , 1.0)).xy;
#else
  gl_Position = P * V * vec4(aPos, 1.0);
  tc = (T * vec4(aPos, 1.0)).xy;
#endif

  lightLevel = length(aPos - eyepos) / 1024.0;
  lightLevel = clamp(float(shade) + lightLevel, 0.5, 63.0);
}
