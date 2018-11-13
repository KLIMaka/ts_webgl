uniform mat4 MVP;

attribute vec3 aPos;
attribute vec4 aColor;

varying vec4 color;

void main() {
  color = aColor;
  gl_Position = MVP * vec4(aPos, 1);
}