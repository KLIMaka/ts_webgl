uniform mat4 P;
uniform mat4 MV;
uniform mat4 MVP;
uniform float size;
uniform vec3 eyepos;

attribute vec3 norm;
attribute vec3 pos;

varying vec3 toEye;

void main() {
    toEye = eyepos - pos;
	vec4 wpos = vec4(pos, 1.0);
    vec4 epos = MV * wpos;
    epos.xy += norm.xy * size;
    gl_Position = P * epos;
}