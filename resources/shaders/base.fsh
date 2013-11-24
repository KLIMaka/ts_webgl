precision mediump float;

uniform vec3 eyedir;

varying float att;
varying vec3 toLight;

void main() {
	vec3 color = vec3(0.2,0.5,1) * att;/// pow(length(toLight) / 5000.0, 2.0);
	color *= dot(normalize(toLight), -normalize(eyedir));
	gl_FragColor = vec4(color,1);
}