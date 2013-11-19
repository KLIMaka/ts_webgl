uniform mat4 MVP;
uniform vec3 eyepos;

attribute vec3 norm;
attribute vec3 pos;

varying float att;

void main() {
	vec3 toEye = eyepos - pos;
	att = max(dot(norm, normalize(toEye)), 0.0);
	gl_Position = MVP * vec4(pos, 1);
}