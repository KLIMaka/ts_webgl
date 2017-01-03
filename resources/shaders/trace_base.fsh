precision mediump float;

uniform sampler2D lm;
uniform vec3 eyedir;

varying vec3 toLight;
varying vec2 lmtc;
varying float emit;

void main() {
	vec3 color = texture2D(lm, lmtc).rgb;
	color *= dot(normalize(toLight), -normalize(eyedir));
	gl_FragColor = vec4(color, 1);
}