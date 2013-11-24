precision mediump float;

uniform vec3 eyedir;

varying vec3 toEye;

void main() {
    vec3 color = vec3(1.0);
    color *= dot(normalize(toEye), -normalize(eyedir));
	gl_FragColor = vec4(color, 1.0);
}