uniform mat4 MVP;

attribute vec3 pos;

void main() {
	gl_Position = MVP * vec4(pos, 1);
}