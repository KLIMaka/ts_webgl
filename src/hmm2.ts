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
var MAP = 'resources/engines/h2/maps/BELTWAY.MP2';
var shadow = [0,0,0,127];

function getDetails(info:any):any {
  var w = 0;
  var h = 0;
  var xoff = info[0].xoff;
  var yoff = info[0].yoff;
  for (var i = 0; i < info.length; i++) {
    var inf = info[i];
    xoff = Math.min(xoff, inf.xoff);
    yoff = Math.min(yoff, inf.yoff);
  }
  for (var i = 0; i < info.length; i++) {
    var inf = info[i];
    w = Math.max(w, -xoff+inf.xoff+inf.pp.getWidth());
    h = Math.max(h, -yoff+inf.yoff+inf.pp.getHeight());
  }
  return {w:w, h:h, xoff:xoff, yoff:yoff};
}
var tmpdst = new Uint8Array(4);

class TilePixelProvider extends pixel.AbstractPixelProvider {

  constructor(private info:any, private details:any) {
    super(details.w, details.h);
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var d = this.details;
    var infos = this.info;
    dst[dstoff+3] = 0;
    for (var i = infos.length-1; i >= 0; i--) {
      var info = infos[i];
      var nx = x+d.xoff-info.xoff;
      var ny = y+d.yoff-info.yoff;
      if (nx < 0 || ny < 0 || nx >= info.pp.getWidth() || ny >= info.pp.getHeight())
        continue;
      info.pp.putToDst(nx, ny, tmpdst, 0);
      dst[dstoff+0] = tmpdst[0];
      dst[dstoff+1] = tmpdst[1];
      dst[dstoff+2] = tmpdst[2];
      dst[dstoff+3] = tmpdst[3];

      if (tmpdst[3] && (tmpdst[3] == 255)) break;
    }
  }
}

function addonsort(a:any, b:any):number {var dl = a.l-b.l; return dl==0?b.q-a.q:dl;}

function createTile():any {
  var icnFile2 = ICN.create(aggFile.get(OBJN.getIcn(obj2)));
  var frame2 = icnFile2.getFrame(tile.indexName2);
  var i2 = icnFile2.getInfo(tile.indexName2);
  var pp2 = new pixel.RGBPalPixelProvider(frame2, pal, i2.width, i2.height, 255, 0, 1, shadow);
  return {pp:pp2, xoff:i2.offsetX, yoff:i2.offsetY, q:0, l:2, i2:tile});
}

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

var tilesInfo:any = [];
var tiles = mapFile.tiles;
var addons = mapFile.addons;
map.onclick = (e) => {
  var x = e.x-8;
  var y = e.y-8;
  var infos = tilesInfo[MU.int(y/tilFile.height)*mapFile.width+MU.int(x/tilFile.width)];
  console.log(infos);
  console.log(getDetails(infos));
  for (var i = 0; i < infos.length; i++) {
    var canvas = IU.createCanvas(infos[i].pp);
    document.body.appendChild(canvas);
  }
}

for (var i = 0; i < tiles.length; i++) {
  var tile = tiles[i];
  var x = MU.int(i % mapFile.width) * tilFile.width;
  var y = MU.int(i / mapFile.width) * tilFile.height;
  var frame = tilFile.getTile(tile.tileIndex);
  var pp:pixel.PixelProvider = new pixel.RGBPalPixelProvider(frame, pal, tilFile.width, tilFile.height, 255, 0, 1, shadow);
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
    var pp1 = new pixel.RGBPalPixelProvider(frame1, pal, i1.width, i1.height, 255, 0, 1, shadow);
    adds.push({pp:pp1, xoff:i1.offsetX, yoff:i1.offsetY, q:0, l:1, i1:tile});
  }
  var obj2 = tile.objectName2;
  if (obj2 != 0) {
    var icnFile2 = ICN.create(aggFile.get(OBJN.getIcn(obj2)));
    var frame2 = icnFile2.getFrame(tile.indexName2);
    var i2 = icnFile2.getInfo(tile.indexName2);
    var pp2 = new pixel.RGBPalPixelProvider(frame2, pal, i2.width, i2.height, 255, 0, 1, shadow);
    adds.push({pp:pp2, xoff:i2.offsetX, yoff:i2.offsetY, q:0, l:2, i2:tile});
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
        var pp1 = new pixel.RGBPalPixelProvider(frame1, pal, i1.width, i1.height, 255, 0, 1, shadow);
        adds.push({pp:pp1, xoff:i1.offsetX, yoff:i1.offsetY, q:add.quantityN%4, l:1, i1:add});
      }
    }
    var obj2 = add.objectNameN2;
    if (obj2 != 0) {
      var icnname2 = OBJN.getIcn(obj2);
      if (icnname2 != null) {
        var icnFile2 = ICN.create(aggFile.get(icnname2));
        var frame2 = icnFile2.getFrame(add.indexNameN2);
        var i2 = icnFile2.getInfo(add.indexNameN2);
        var pp2 = new pixel.RGBPalPixelProvider(frame2, pal, i2.width, i2.height, 255, 0, 1, shadow);
        adds.push({pp:pp2, xoff:i2.offsetX, yoff:i2.offsetY, q:add.quantityN%4, l:2, i2:add});
      }
    }
  }

  if (adds.length != 0){
    adds.sort(addonsort);
    var details = getDetails(adds);
    pp = new TilePixelProvider(adds, details);
    IU.blendToCanvas(pp, map, x+details.xoff, y+details.yoff);
  }
  tilesInfo.push(adds);
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