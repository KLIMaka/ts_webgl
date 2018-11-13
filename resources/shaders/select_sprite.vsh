uniform mat4 P;
uniform mat4 MV;

attribute vec3 aNorm;
attribute vec3 aPos;
attribute vec4 aIdx;

varying vec4 idx;

void main() {
  vec4 wpos = vec4(aPos, 1.0);
  vec4 epos = MV * wpos;
  epos.xy += aNorm.xy;
  gl_Position = P * epos;
  idx = aIdx;
}