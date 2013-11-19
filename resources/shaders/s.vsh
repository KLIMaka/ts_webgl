precision mediump float;

uniform mat4 MVP;

attribute vec3 norm;
attribute vec3 pos;

varying float att;

void main() {
	vec3 w_pos = (MVP * vec4(pos, 1)).xyz;
	att = max(dot(norm, -normalize(w_pos)), 0.0);
	gl_Position = MVP * vec4(pos, 1);
}