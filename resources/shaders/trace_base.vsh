uniform mat4 MVP;
uniform vec3 eyepos;

attribute vec3 aPos;
attribute vec2 aLMTc;
attribute float aShade;

varying vec3 toLight;
varying vec2 lmtc;
varying float emit;

void main() {
	vec3 toEye = eyepos - aPos;
	toLight = toEye;
	lmtc = aLMTc;
  emit = aShade;
	gl_Position = MVP * vec4(aPos, 1);
}