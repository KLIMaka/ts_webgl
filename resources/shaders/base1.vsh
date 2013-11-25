uniform mat4 MVP;

attribute vec3 norm;
attribute vec3 pos;

varying vec2 coord;

void main() {
        coord = norm.st;
        gl_Position = MVP * vec4(pos, 1);
}