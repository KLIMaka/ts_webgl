precision mediump float;
uniform mat4 MVP;
uniform vec3 eyepos;
uniform mat4 texMat;
uniform int shade;

attribute vec3 aPos;

varying float att;
varying vec2 tc;

void main() {
	att = (( -float(shade) * 3.0 + 190.0) / 256.0);
	att -= length(aPos - eyepos) / (70.0 * 1024.0);
	tc = (texMat * vec4(aPos, 1.0)).xy;
	gl_Position = MVP * vec4(aPos, 1.0);
}