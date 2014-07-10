import getter = require('./libs/getter');
import WL = require('./modules/engines/wl');
import Panel = require('./modules/ui/drawpanel');
import P = require('./modules/pixelprovider');

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
 
for (var i = 0; i < game.maps.length; i++) {
  var map = game.maps[i];
  var info = map.info;
  var size = map.mapSize;

  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = size * 16;
  canvas.height = size * 16;
  document.body.appendChild(canvas);

  var tileset = info.tileset < 4 ? t0.tilesets[info.tileset] : t1.tilesets[info.tileset-4];
  var imgs = new Array<P.RGBPalPixelProvider>(tileset.pics.length);
  for (var j = 0; j < tileset.pics.length; j++){
    imgs[j] = new P.RGBPalPixelProvider(new Uint8Array(tileset.pics[j].pixels), egapal, 16, 16);
  }

  var tilemap = map.tileMap.map;
  var provider = new Panel.PixelDataProvider(size*size, (i:number) => {
    var tile = tilemap[i];
    if (tile >= 10)
      return imgs[tile-10];
    return null;
  });

  var p = new Panel.DrawPanel(canvas, provider);
  p.setCellSize(16, 16);
  p.draw();

}
});