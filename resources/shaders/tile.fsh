precision mediump float;

uniform vec3 CELL;
uniform vec3 TILE;
uniform vec3 SIZE;

uniform sampler2D tiles;
uniform sampler2D map;

varying vec2 tc;

void main() {
  int tileId = int(texture2D(map, tc).r * 256.0);
  float tileU = float(tileId - (tileId / int(TILE.x)) * int(TILE.x)) / TILE.x;
  float tileV = float(tileId / int(TILE.y)) / TILE.y;
  float offU = fract(tc.x*CELL.x)/TILE.x;
  float offV = fract(tc.y*CELL.y)/TILE.y;
  vec3 color = texture2D(tiles, vec2(tileU+offU, tileV+offV)).rgb;
  gl_FragColor = vec4(color, 1.0);
}