import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import browser = require('./libs/browser');
import pixel = require('./modules/pixelprovider');
import imgutils = require('./libs/imgutils');
import pool = require('./libs/pool');
import tmpbuffer = require('./libs/tmpbuffer');

import TmpArray = tmpbuffer.TempByteArray;

var resnum = browser.getQueryVariable('res');
var P = 'resources/engines/raven2/COLORS';
var R = 'resources/engines/raven2/RES'+resnum;

getter.loader
.load(R)
.load(P)
.finish(() => {

var bufferPool = new pool.Pool<TmpArray>(10, ()=>new TmpArray());

var LZbuf = new Uint8Array(0x1000);
function LZ(r:data.DataViewStream, size:number):TmpArray {
  var arr = bufferPool.get();
  var ret = arr.recreate(size);
  var retoff = 0;
  for (var i = 0; i < 0x0fee; i++) {
    LZbuf[i] = 0xfe;
  }
  var off = 0x0fee;
  while(retoff < size) {
    var bits = r.readUByte();
    for (var i = 0; i < 8; i++) {
      var b = (bits >> i) & 1;
      if (b == 1) {
        var _ = r.readUByte();
        ret[retoff++] = _;
        LZbuf[off] = _;
        off = (off + 1) % 0x1000;
      } else {
        var zt = r.readUByte();
        var z = (zt >> 4) & 0xf;
        var t = zt & 0xf;
        var xy = r.readUByte();
        var x = (xy >> 4) & 0xf;
        var y = xy & 0xf;

        var xzt = (x << 8) | (z << 4) | t; 
        for (var j = 0; j < y+3; j++) {
          var _ = LZbuf[(xzt+j) % 0x1000];
          ret[retoff++] = _;
          LZbuf[off] = _;
          off = (off + 1) % 0x1000;
        }
      }
    }
  }
  return arr;
}

function read(r:data.DataViewStream, size:number, mod:number):TmpArray {
  if (mod == 3) {
    return LZ(r, size);
  } else {
    var arr = bufferPool.get();
    var ret = arr.recreate(size);
    for (var i = 0; i < size; i++)
      ret[i] = r.readUByte();
    return arr;
  }
}

function createImage(w:number, h:number, data:Uint8Array, trans:number, pal:number[], dw:boolean=true, isFlip:boolean=false):void {
  var provider:pixel.PixelProvider = new pixel.RGBPalPixelProvider(data, pal, w, h, 255, trans);
  if (isFlip)
    provider = pixel.axisSwap(provider);
  if (dw)
    provider = pixel.resize(provider, provider.getWidth()*2, provider.getHeight());
  // provider = pixel.resize(provider, provider.getWidth()/2, provider.getHeight()/2);
  document.body.appendChild(imgutils.createCanvas(provider));
}

function read3dSprite(d:Uint8Array, pal:number[]) {
  var r = new data.DataViewStream(d.buffer, true);
  var w = r.readUShort();
  var left = r.readUShort();
  var right = r.readUShort();
  var up = r.readUShort();
  var h = r.readUShort();
  var colOffs = new Array<number>(right-left);
  if (colOffs.length == 0)
    return;
  for (var i = 0; i < colOffs.length; i++)
    colOffs[i] = r.readUShort();
  var arr = bufferPool.get();
  var img = arr.recreate(w*h);

  var pixels = r.mark();
  for (var i = 0; i< colOffs.length; i++) {
    r.setOffset(colOffs[i]);
    var x = r.readUShort();
    while (x != 0) {
      var loff = x/2;
      var roff = r.readShort();
      var hoff = r.readUShort()/2;
      var poff = hoff + roff;
      var rows = loff - hoff;
      var mark = r.mark();
      r.setOffset(poff);
      for (var j = 0; j < rows; j++) {
        img[(j+hoff)*w+left+i] = r.readUByte();
      }
      r.setOffset(mark);

      x = r.readUShort();
    }
  }

  createImage(w, h, img.subarray(0,w*h), 254, pal);
  bufferPool.ret(arr);
}

function readFile(r:data.DataViewStream, pal:number[]) {
  var signature = r.readUShort();
  var type = r.readUByte();
  var headerSize = r.readUShort();

  switch (type)
  {
    case 1: { // sprite
      var imgnum = r.readUShort();
      var h = r.readUShort();
      if (h == 1) {
        h = imgnum;
        imgnum = 1;
      }
      var w = r.readUByte() * 8;
      var trans = r.readUByte();
      var mod = r.readUByte();
      var unknown = r.readUByte();

      var data = read(r, imgnum*w*h, mod);
      for (var i = 0; i < imgnum; i++)
        createImage(w, h, data.get().subarray(i*w*h, i*w*h+w*h), trans, pal);
      bufferPool.ret(data);
      console.log('sprite x'+imgnum + ' w:'+w+' h:'+h+' mod:'+mod);
      break;
    }

    case 2: { // font
      var ws = new Array<number>(128);
      for (var i = 0; i < 128; i++)
        ws[i] = r.readUByte();
      var imgnum = r.readUShort();
      var h = r.readUShort();
      var w = r.readUByte() * 8;
      var trans = r.readUByte();
      var mod = r.readUByte();
      var unknown = r.readUByte();

      var data = read(r, imgnum*w*h, mod);
      for (var i = 0; i < imgnum; i++)
        createImage(w, h, data.get().subarray(i*w*h, i*w*h+w*h), trans, pal);
      bufferPool.ret(data);
      console.log('font x'+imgnum + ' w:'+w+' h:'+h+' mod:'+mod);
      break;
    }

    case 5: { //texture
      var mod = r.readUByte();
      var len = r.readUInt();
      var data = read(r, len, mod);
      var cols = data.get()[0] + (data.get()[1]*256);
      createImage(cols, 0x40, data.get().subarray(2, len), 254, pal, true, true);
      bufferPool.ret(data);
      break;
    }

    case 6: { //3D sprite
      var mod = r.readUByte();
      var len = r.readUInt();
      var data = read(r, len, mod);
      read3dSprite(data.get(), pal);
      bufferPool.ret(data);
      break;
    }

    default: {
      console.log('type = ' + type);
    }
  }
}

function readPal(r:data.DataViewStream, off:number):number[] {
  r.setOffset(off+1);
  var pal = new Array<number>(256*3);
  for (var i = 0; i < 255; i++){
    pal[i*3+0] = r.readUByte() * 4;
    pal[i*3+1] = r.readUByte() * 4;
    pal[i*3+2] = r.readUByte() * 4;
  }
  return pal;
}

function drawPals(r:data.DataViewStream) {
  var count = r.readUByte();
  var palData = new Uint8Array(256);
  for (var i = 0; i < 256; i++)
    palData[i] = i;
  for (var i = 0; i < count; i++) {
    var pal = readPal(r, i*256*3+1);
    createImage(16, 16, palData, 0, pal, false);
  }
}


var palnum = browser.getQueryVariable('pal');
var palfile = new data.DataViewStream(getter.get(P), true);
// drawPals(palfile);
var pal = readPal(palfile, 256*3*palnum);
var res = new data.DataViewStream(getter.get(R), true);
var size = res.readUInt();
var offsets = new Array<number>(size);
for (var i = 0; i < size; i++) {
  offsets[i] = res.readUInt();
}

for (var i = 0; i < size-1; i++){
  res.setOffset(offsets[i]);
  readFile(res,pal);
}

});