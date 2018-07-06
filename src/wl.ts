import getter = require('./libs/getter');
import WLG = require('./modules/engines/wl/game');
import HTDS = require('./modules/engines/wl/htds');
import P = require('./modules/pixelprovider');
import IU = require('./libs/imgutils');
import MU = require('./libs/mathutils');
import browser = require('./libs/browser');
import AB = require('./libs/asyncbarrier');

var gn = browser.getQueryVariable('game');
var ab = AB.create();
getter.preload('resources/engines/wl/GAME'+gn, ab.callback('R'));
getter.preload('resources/engines/wl/ALLHTDS1', ab.callback('T0'));
getter.preload('resources/engines/wl/ALLHTDS2', ab.callback('T1'));
ab.wait((res) => {

var egapal = new Uint8Array([
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
]);

var game = WLG.create(res.R);
var t0 = HTDS.create(res.T0);
var t1 = HTDS.create(res.T1);

console.log(game);
console.log(t0);
console.log(t1);
 
var tilesets = new Array<HTMLCanvasElement[]>();
for (var i = 0; i < 9; i++) {
  var tileset = i < 4 ? t0.tilesets[i] : t1.tilesets[i-4];
  var imgs = new Array<HTMLCanvasElement>(tileset.pics.length);
  for (var j = 0; j < tileset.pics.length; j++){
    imgs[j] = IU.createCanvas(P.fromPal(tileset.pics[j].pixels, egapal, 16, 16));
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