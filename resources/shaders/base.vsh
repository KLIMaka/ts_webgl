uniform mat4 MVP;
uniform vec3 eyepos;

attribute vec3 aNorm;
attribute vec3 aPos;
attribute vec4 aIdx;

varying float att;
varying vec3 toLight;
varying vec4 idx;

void main() {
	vec3 toEye = eyepos - aPos;
	att = max(dot(aNorm, normalize(toEye)), 0.0);
	toLight = toEye;
	idx = aIdx;
	gl_Position = MVP * vec4(aPos, 1);
}