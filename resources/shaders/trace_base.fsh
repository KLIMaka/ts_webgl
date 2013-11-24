precision mediump float;

uniform vec3 eyedir;
varying vec3 toLight;

void main() {
	vec3 color = vec3(0.0);
	color *= dot(normalize(toLight), -normalize(eyedir));
	gl_FragColor = vec4(color,1);
}