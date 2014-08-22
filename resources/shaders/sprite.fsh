precision mediump float;
uniform sampler2D base;

varying vec2 tc;
varying float shade;

void main() {
	vec3 color = texture2D(base, tc).rgb * shade;
	gl_FragColor = vec4(color, 1.0);
}