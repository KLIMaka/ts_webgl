precision mediump float;

uniform sampler2D texture;
varying vec2 coord;

void main() {
        gl_FragColor = vec4(texture2D(texture, coord).rgb, 1);
}