precision mediump float;

uniform vec3 eyedir;
uniform vec4 activeIdx;

varying float att;
varying vec3 toLight;
varying vec4 idx;

void main() {
    vec4 a = activeIdx;//vec4(11.0/256.0,0.0,0.0,0.0);
    float dist = distance(idx,a);
	vec3 color = (dist < 0.001 ? vec3(1,0.5,0.2) : vec3(0.2,0.5,1)) * att;
	color *= dot(normalize(toLight), -normalize(eyedir));
	gl_FragColor = vec4(color,1);
}