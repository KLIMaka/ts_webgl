precision mediump float;

varying float att;

void main() {
	vec3 color = vec3(0.2,0.5,1) * att;
	gl_FragColor = vec4(color,1);
}