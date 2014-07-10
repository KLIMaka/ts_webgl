import getter = require('./libs/getter');
import WL = require('./modules/engines/wl');
import Panel = require('./modules/ui/drawpanel');
import P = require('./modules/pixelprovider');
import IU = require('./libs/imgutils');
import MU = require('./libs/mathutils');

var R = 'resources/engines/wl/GAME1';
var T0 = 'resources/engines/wl/ALLHTDS1';
var T1 = 'resources/engines/wl/ALLHTDS2';
getter.loader
.load(R)
.load(T0)
.load(T1)
.finish(() => {

var egapal = [
  0x00, 0x00, 0x00, 
  0x00, 0x00, 0xaa,
  0x00, 0xaa, 0x00,
  0x00, 0xaa, 0xaa, 
  0xaa, 0x00, 0x00, 
  0xaa, 0x00, 0xaa, 
  0xaa, 0x55, 0x00,
  0xaa, 0xaa, 0xaa, 
  0x55, 0x55, 0x55,
  0x55, 0x55, 0xff, 
  0x55, 0xff, 0x55, 
  0x55, 0xff, 0xff, 
  0xff, 0x55, 0x55, 
  0xff, 0x55, 0xff, 
  0xff, 0xff, 0x55,
  0xff, 0xff, 0xff
]

var game = new WL.Game(getter.get(R));
var t0 = new WL.HTDS(getter.get(T0));
var t1 = new WL.HTDS(getter.get(T1));
 
var tilesets = new Array<HTMLCanvasElement[]>();
for (var i = 0; i < 9; i++) {
  var tileset = i < 4 ? t0.tilesets[i] : t1.tilesets[i-4];
  var imgs = new Array<HTMLCanvasElement>(tileset.pics.length);
  for (var j = 0; j < tileset.pics.length; j++){
    imgs[j] = IU.createCanvas(new P.RGBPalPixelProvider(tileset.pics[j].pixels, egapal, 16, 16));
  }
  tilesets.push(imgs);
}

for (var i = 0; i < game.maps.length; i++) {
  var map = game.maps[i];
  var info = map.info;
  var size = map.mapSize;

  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = size * 16;
  canvas.height = size * 16;
  var ctx = canvas.getContext('2d');

  var tiles = tilesets[info.tileset];
  var tilemap = map.tileMap.map;
  for (var j = 0; j < size*size; j++) {
    var x = (j % size) * 16;
    var y = MU.int(j / size) * 16;
    var tile = tilemap[j];
    if (tile >= 10)
      ctx.drawImage(tiles[tile-10], x, y);
  }
  document.body.appendChild(canvas);
}

});