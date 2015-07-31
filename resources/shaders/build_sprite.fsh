precision mediump float;

uniform int activeIdx;
uniform sampler2D base;

varying float att;
varying float idx;
varying vec2 tc;

void main() {
  int current = int(idx);
  vec3 select = activeIdx==current 
    ? vec3(1,0.5,0.2) 
    : vec3(1,1,1);
  vec4 color = texture2D(base, tc);
  if (color.a == 0.0)
    discard;
  gl_FragColor = vec4(color.rgb*att*select, color.a);
}