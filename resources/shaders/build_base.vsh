precision mediump float;
uniform mat4 MVP;
uniform vec3 eyedir;
uniform vec3 eyepos;

attribute vec3 aNorm;
attribute vec3 aPos;
attribute vec4 aIdx;
attribute vec2 aTc;
attribute float aShade;

varying float att;
varying vec2 tc;
varying vec4 idx;

void main() {
	att = ((-aShade*3.0 + 190.0) / 256.0);
	att -= length(aPos - eyepos) / (70.0 * 1024.0);
	idx = aIdx;
	tc = aTc;
	gl_Position = MVP * vec4(aPos, 1);
}