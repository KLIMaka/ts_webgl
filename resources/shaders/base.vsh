uniform mat4 MVP;

attribute vec3 aNorm;
attribute vec3 aPos;
attribute vec4 aIdx;
attribute vec2 aTc;

varying float att;
varying float idx;
varying vec2 tc;

int unpack (vec4 c) {
  return int(c.r*256.0) + int(c.g*256.0)*256 + int(c.b*256.0)*65536;
}

void main() {
	att = max(dot(aNorm, normalize(vec3(1.0, 2.0, 3.0))), 0.1);
	idx = float(unpack(aIdx));
	tc = aTc;
	gl_Position = MVP * vec4(aPos, 1);
}