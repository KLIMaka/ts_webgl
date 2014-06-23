precision mediump float;

uniform vec3 eyedir;
uniform vec4 activeIdx;

varying float att;
varying vec3 toLight;
varying vec4 idx;

int unpack (vec4 c) {
  return int(c.r*256.0) + int(c.r*256.0)*256 + int(c.r*256.0)*256*256;
}

void main() {
  int active = unpack(activeIdx);
  int current = unpack(idx);

  vec3 color = (active==current ? vec3(1,0.5,0.2) : vec3(0.2,0.5,1)) * att;
  color *= dot(normalize(toLight), -normalize(eyedir));
  gl_FragColor = vec4(color,1);
}