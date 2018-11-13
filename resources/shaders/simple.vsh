uniform mat4 VP;
uniform mat4 M;

attribute vec3 aNorm;
attribute vec3 aPos;
attribute vec2 aTc;

varying vec2 tc;
varying vec3 normal;

void main() {
	tc = aTc;
	normal = normalize(mat3(M) * aNorm);
	gl_Position = VP * M * vec4(aPos, 1);
}