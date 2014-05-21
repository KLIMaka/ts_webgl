uniform mat4 MVP;

attribute vec3 aPos;
attribute vec4 aIdx;

varying vec4 idx;

void main() {
	gl_Position = MVP * vec4(aPos, 1);
	idx = aIdx;
}