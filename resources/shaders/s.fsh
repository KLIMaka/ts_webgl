precision mediump float;

varying float att;

void main() {
	gl_FragColor = vec4(0.2,0.5,1,1) * att;
}