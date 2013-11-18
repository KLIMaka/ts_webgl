uniform mat4 MVP;

attribute vec3 pos;
attribute vec3 norm;

varying float att;

void main() {
	gl_Position = MVP * vec4(pos, 1);
	att = dot(norm, vec3(0, 0, -1));
}