uniform mat4 MVP;

attribute vec3 aPos;
attribute vec2 aTc;

varying vec2 tc;

void main() {
	tc = aTc;
	gl_Position = MVP * vec4(aPos, 1);
}