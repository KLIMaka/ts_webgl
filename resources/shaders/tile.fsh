#include "resources/shaders/common.fsh"
precision mediump float;

uniform vec2 CELL;
uniform vec2 TILE;

uniform sampler2D tiles;
uniform sampler2D map;

varying vec2 tc;

void main() {
  int tileId = int(texture2D(map, tc).r * 256.0);
  vec2 tileOrig = vec2(grid(tileId, int(TILE.x))) / TILE;
  vec2 tileOff = fract(tc * CELL) / TILE;
  vec3 color = texture2D(tiles, tileOrig + tileOff).rgb;
  gl_FragColor = vec4(color, 1.0);
}