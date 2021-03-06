import AGG = require('./modules/engines/hmm2/agg');
import ICN = require('./modules/engines/hmm2/icn');
import OBJN = require('./modules/engines/hmm2/objn');
import MP2 = require('./modules/engines/hmm2/mp2');
import TIL = require('./modules/engines/hmm2/til');
import getter = require('./libs/getter');
import pixel = require('./modules/pixelprovider');
import IU = require('./libs/imgutils');
import MU = require('./libs/mathutils');
import browser = require('./libs/browser');

declare var config;
var RES = 'resources/engines/h2/heroes2.agg';
var MAP = 'resources/engines/h2/maps/' + browser.getQueryVariable('map');;
var shadow = new Uint8Array([0,0,0,127]);

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
// 812
// 7 3
// 654
var tmpblend = new Uint8Array(4*12);
var a = 3/24;
var b = 2/24;
var c = 1/24;
function blend() {
  var s = 0;
  s += tmpblend[3]>=127?a:0;
  s += tmpblend[7]>=127?b:0;
  s += tmpblend[11]>=127?a:0;
  s += tmpblend[15]>=127?b:0;
  s += tmpblend[19]>=127?a:0;
  s += tmpblend[23]>=127?b:0;
  s += tmpblend[27]>=127?a:0;
  s += tmpblend[31]>=127?b:0;
  s += tmpblend[35]>=127?c:0;
  s += tmpblend[39]>=127?c:0;
  s += tmpblend[43]>=127?c:0;
  s += tmpblend[47]>=127?c:0;

  return MU.int(100*s);
}

function renderOffset(pp:pixel.PixelProvider, x:number, y:number, off:number, curr:number) {
  if (x < 0 || y < 0 || x >= pp.getWidth() || y >= pp.getHeight()){
    tmpblend[off+3] = curr;
    return;
  }
  pp.putToDst(x, y, tmpblend, off, pixel.BlendNormal);
}

class ShadowBlendPixelProvider extends pixel.AbstractPixelProvider {

  constructor(private provider:TilePixelProvider) {
    super(provider.getWidth(), provider.getHeight());
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var pp = this.provider;
    pp.putToDst(x, y, dst, dstoff);
    var a = dst[dstoff+3];
    if (a == 255)
      return;

    renderOffset(pp, x+0, y-1, 0, a);
    renderOffset(pp, x+1, y-1, 4, a);
    renderOffset(pp, x+1, y+0, 8, a);
    renderOffset(pp, x+1, y+1, 12, a);
    renderOffset(pp, x+0, y+1, 16, a);
    renderOffset(pp, x-1, y+1, 20, a);
    renderOffset(pp, x-1, y+0, 24, a);
    renderOffset(pp, x-1, y-1, 28, a);

    renderOffset(pp, x-2, y-0, 32, a);
    renderOffset(pp, x-0, y-2, 36, a);
    renderOffset(pp, x+2, y-0, 40, a);
    renderOffset(pp, x-0, y+2, 44, a);
    var b = blend();

    dst[dstoff+3] = b;
  }
}

class TilePixelProvider extends pixel.AbstractPixelProvider {

  constructor(private info:any, private details:any) {
    super(details.w, details.h);
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var d = this.details;
    var infos = this.info;
    var a = 0
    dst[dstoff+3] = a;
    for (var i = infos.length-1; i >= 0; i--) {
      var info = infos[i];
      var nx = x+d.xoff-info.xoff;
      var ny = y+d.yoff-info.yoff;
      if (nx < 0 || ny < 0 || nx >= info.pp.getWidth() || ny >= info.pp.getHeight())
        continue;
      
      info.pp.putToDst(nx, ny, dst, dstoff, pixel.BlendNormal);

      if (dst[dstoff+3] == 255) break;

      dst[dstoff+3] = Math.max(dst[dstoff+3], a);
      a = dst[dstoff+3];
    }
  }
}

function addonsort(a:any, b:any):number {var dl = a.l-b.l; return dl==0?b.q-a.q:dl;}


getter.loader
.load(RES)
.load(MAP)
.finish(()=>{

var aggFile = AGG.create(getter.get(RES));
var pal = AGG.createPalette(aggFile.get('KB.PAL'));
var tilFile = TIL.create(aggFile.get('GROUND32.TIL'));
var mapFile = MP2.create(getter.get(MAP));
var MAP_W = tilFile.width*mapFile.width;
var MAP_H = tilFile.height*mapFile.height;

var map = IU.createEmptyCanvas(MAP_W, MAP_H);
map.style.position='absolute';
document.body.appendChild(map);
var tmap = IU.createEmptyCanvas(MAP_W, MAP_H);
tmap.style.position='absolute';
document.body.appendChild(tmap);
var smap = IU.createEmptyCanvas(MAP_W, MAP_H);
smap.style.position='absolute';
document.body.appendChild(smap);

var icnCache:{[index:string]:ICN.IcnFile} = {};
function createTile(obj:number, idx:number, count:number, level:number, adds:any, tile:any):any {
  if (obj == 0)
    return;
  var icnName = OBJN.getIcn(obj);
  var icnFile = icnCache[icnName];
  if (icnFile == undefined) {
    icnFile = ICN.create(aggFile.get(icnName + '.ICN'));
    icnCache[icnName] = icnFile;
  }
  if (icnFile == null)
    return;
  var frame = icnFile.getFrame(idx);
  var i = icnFile.getInfo(idx);
  var pp = new pixel.RGBPalPixelProvider(frame, pal, i.width, i.height, 255, 0, 1, shadow);
  adds.push({pp:pp, xoff:i.offsetX, yoff:i.offsetY, q:count, l:level, tile:tile});

  var anim = OBJN.getAnimFrame(icnName, idx, 0);
  if (anim == 0)
    return;

  frame = icnFile.getFrame(anim);
  i = icnFile.getInfo(anim);
  pp = new pixel.RGBPalPixelProvider(frame, pal, i.width, i.height, 255, 0, 1, shadow);
  adds.push({pp:pp, xoff:i.offsetX, yoff:i.offsetY, q:count, l:level, tile:tile});
}

var uniqInfo:any = [];
function addUniqTile(tile, x, y) {
  var id = tile.uniqNumber1 == 0 ? tile.uniqNumber2 : tile.uniqNumber1;
  if (id == 0) return;
  var uniq = uniqInfo[id];
  if (uniq == undefined) {
    uniq = [];
    uniqInfo[id] = uniq;
  }
  uniq.push({tile:tile, x:x, y:y});
}
function addUniqAddon(addon, x, y) {
  var id = addon.uniqNumberN1 == 0 ? addon.uniqNumberN2 : addon.uniqNumberN1;
  if (id == 0) return;
  var uniq = uniqInfo[id];
  if (uniq == undefined) {
    uniq = [];
    uniqInfo[id] = uniq;
  }
  uniq.push({addon:addon, x:x, y:y});
}

var tilesInfo:any = [];
var tiles = mapFile.tiles;
var addons = mapFile.addons;
smap.onclick = (e) => {
  var x = e.pageX-8;
  var y = e.pageY-8;
  var mx = MU.int(x/tilFile.width);
  var my = MU.int(y/tilFile.height);
  var infos = tilesInfo[my*mapFile.width+mx];
  console.log(infos);
  console.log(getDetails(infos));
  console.log(mx, my, x, y);
  var ids = [];
  for (var i = 0; i < infos.length; i++) {
    ids.push(infos[i].tile.uniqNumber1);
    ids.push(infos[i].tile.uniqNumberN1);
    ids.push(infos[i].tile.uniqNumber2);
    ids.push(infos[i].tile.uniqNumberN2);
    var canvas = IU.createCanvas(infos[i].pp);
    document.body.appendChild(canvas);
  }
  document.body.appendChild(document.createElement('br'));
  var pp = new ShadowBlendPixelProvider(new TilePixelProvider(infos, getDetails(infos)));
  document.body.appendChild(IU.createCanvas(pp));

  var ctx = smap.getContext('2d');
  // ctx.fillStyle="rgba(0,0,0,0)";
  // ctx.fillRect(0, 0, MAP_W, MAP_H);
  ctx.fillStyle="#000000";
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (id == undefined || id == 0)
      continue;
    var info = uniqInfo[id];
    if (info == undefined)
      continue;
    console.log(id);
    for (var t = 0; t < info.length; t++) {
      var tile = info[t];
      ctx.rect(tile.x, tile.y, 32, 32);
    }
  }
  ctx.stroke();

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

  createTile(tile.objectName1, tile.indexName1, 0, 1, adds, tile);
  createTile(tile.objectName2, tile.indexName2, 0, 2, adds, tile);
  addUniqTile(tile, x, y);

  for (var addon = tile.indexAddon; addon != 0; addon = addons[addon].indexAddon) {
    var add = addons[addon];
    createTile(add.objectNameN1*2, add.indexNameN1, add.quantityN%4, 1, adds, add);
    createTile(add.objectNameN2, add.indexNameN2, add.quantityN%4, 2, adds, add);
    addUniqAddon(add, x, y);
  }

  if (adds.length != 0){
    adds.sort(addonsort);
    var details = getDetails(adds);
    pp = new ShadowBlendPixelProvider(new TilePixelProvider(adds, details));
    IU.drawToCanvas(pp, tmap, x+details.xoff, y+details.yoff);
  }
  tilesInfo[i] = adds;
}

console.log(aggFile);
console.log(mapFile);
console.log(uniqInfo);

});