import AGG = require('./modules/engines/hmm2/agg');
import ICN = require('./modules/engines/hmm2/icn');
import OBJN = require('./modules/engines/hmm2/objn');
import MP2 = require('./modules/engines/hmm2/mp2');
import TIL = require('./modules/engines/hmm2/til');
import getter = require('./libs/getter');
import pixel = require('./modules/pixelprovider');
import IU = require('./libs/imgutils');
import MU = require('./libs/mathutils');

var RES = 'resources/engines/h2/heroes2.agg';
var MAP = 'resources/engines/h2/maps/PANDAMON.MP2';

function addonsort(a:any, b:any):number {return b.q-a.q}

getter.loader
.load(RES)
.load(MAP)
.finish(()=>{

var aggFile = AGG.create(getter.get(RES));
var pal = AGG.createPalette(aggFile.get('KB.PAL'));
var tilFile = TIL.create(aggFile.get('GROUND32.TIL'));
var mapFile = MP2.create(getter.get(MAP));
var map:HTMLCanvasElement = document.createElement('canvas');
map.width = tilFile.width*mapFile.width;
map.height = tilFile.height*mapFile.height;
document.body.appendChild(map);

var tiles = mapFile.tiles;
var addons = mapFile.addons;
for (var i = 0; i < tiles.length; i++) {
  var tile = tiles[i];
  var x = MU.int(i % mapFile.width) * tilFile.width;
  var y = MU.int(i / mapFile.width) * tilFile.height;
  var frame = tilFile.getTile(tile.tileIndex);
  var pp:pixel.PixelProvider = new pixel.RGBPalPixelProvider(frame, pal, tilFile.width, tilFile.height, 255, 0);
  if (tile.shape%4 == 1)
    pp = pixel.yflip(pp);
  else if (tile.shape%4 == 2)
    pp = pixel.xflip(pp);
  else if (tile.shape%4 == 3)
    pp = pixel.xyflip(pp);
  IU.drawToCanvas(pp, map, x, y);

  var adds:any = [];

  var obj1 = tile.objectName1;
  if (obj1 != 0) {
    var icnFile1 = ICN.create(aggFile.get(OBJN.getIcn(obj1)));
    var frame1 = icnFile1.getFrame(tile.indexName1);
    var i1 = icnFile1.getInfo(tile.indexName1);
    var pp1 = new pixel.RGBPalPixelProvider(frame1, pal, i1.width, i1.height, 255, 0);
    adds.push({pp:pp1, x:x+i1.offsetX, y:y+i1.offsetY, q:0});
    // IU.blendToCanvas(pp1, map, x+i1.offsetX, y+i1.offsetY);
  }
  var obj2 = tile.objectName2;
  if (obj2 != 0) {
    var icnFile2 = ICN.create(aggFile.get(OBJN.getIcn(obj2)));
    var frame2 = icnFile2.getFrame(tile.indexName2);
    var i2 = icnFile2.getInfo(tile.indexName2);
    var pp2 = new pixel.RGBPalPixelProvider(frame2, pal, i2.width, i2.height, 255, 0);
    adds.push({pp:pp2, x:x+i2.offsetX, y:y+i2.offsetY, q:0});
    // IU.blendToCanvas(pp2, map, x+i2.offsetX, y+i2.offsetY);
  }


  for (var addon = tile.indexAddon; addon != 0; addon = addons[addon].indexAddon) {
    var add = addons[addon];
    var obj1 = add.objectNameN1 * 2;
    if (obj1 != 0) {
      var icnname1 = OBJN.getIcn(obj1);
      if (icnname1 != null) {
        var icnFile1 = ICN.create(aggFile.get(icnname1));
        var frame1 = icnFile1.getFrame(add.indexNameN1);
        var i1 = icnFile1.getInfo(add.indexNameN1);
        var pp1 = new pixel.RGBPalPixelProvider(frame1, pal, i1.width, i1.height, 255, 0);
        adds.push({pp:pp1, x:x+i1.offsetX, y:y+i1.offsetY, q:add.quantityN});
        // IU.blendToCanvas(pp1, map, x+i1.offsetX, y+i1.offsetY);
      }
    }
    var obj2 = add.objectNameN2;
    if (obj2 != 0) {
      var icnname2 = OBJN.getIcn(obj2);
      if (icnname2 != null) {
        var icnFile2 = ICN.create(aggFile.get(icnname2));
        var frame2 = icnFile2.getFrame(add.indexNameN2);
        var i2 = icnFile2.getInfo(add.indexNameN2);
        var pp2 = new pixel.RGBPalPixelProvider(frame2, pal, i2.width, i2.height, 255, 0);
        adds.push({pp:pp2, x:x+i2.offsetX, y:y+i2.offsetY, q:add.quantityN});
        // IU.blendToCanvas(pp2, map, x+i2.offsetX, y+i2.offsetY);
      }
    }
  }

  adds.sort(addonsort);
  for (var ai = 0; ai < adds.length; ai++){
    var a = adds[ai];
    IU.blendToCanvas(a.pp, map, a.x, a.y);
  }
}

// var list = aggFile.getList();
// for (var f = 0; f < list.length; f++) {
//   var fname = list[f];
//   if (!fname.match(/.ICN$/))
//     continue;
//   var icnFile = ICN.create(aggFile.get(fname));
//   for (var i = 0; i < icnFile.getCount(); i++) {
//     var frame = icnFile.getFrame(i);
//     var size = icnFile.getInfo(i);
//     var pp = new pixel.RGBPalPixelProvider(frame, pal, size.width, size.height, 255, 0);
//     document.body.appendChild(IU.createCanvas(pp));
//   }
// }


console.log(aggFile);
console.log(mapFile);

});