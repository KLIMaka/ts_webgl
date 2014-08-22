uniform mat4 P;
uniform mat4 MV;

attribute vec3 aPos;
attribute vec2 aSize;
attribute vec2 aTc;
attribute float aShade;

varying vec2 tc;
varying float shade;

void main() {
	vec4 wpos = vec4(aPos, 1.0);
    vec4 epos = MV * wpos;
    epos.xy += aSize;
    gl_Position = P * epos;
    tc = aTc;
    shade = ((-aShade*2.0 + 190.0) / 256.0);
}