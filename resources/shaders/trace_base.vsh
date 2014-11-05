uniform mat4 MVP;
uniform vec3 eyepos;

attribute vec3 aPos;

varying vec3 toLight;

void main() {
	vec3 toEye = eyepos - aPos;
	toLight = toEye;
	gl_Position = MVP * vec4(aPos, 1);
}