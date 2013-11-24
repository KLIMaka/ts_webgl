uniform mat4 MVP;
uniform vec3 eyepos;

attribute vec3 norm;
attribute vec3 pos;

varying vec3 toLight;

void main() {
	vec3 toEye = eyepos - pos;
	toLight = toEye;
	gl_Position = MVP * vec4(pos, 1);
}