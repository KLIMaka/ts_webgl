import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import browser = require('./libs/browser');

var resnum = browser.getQueryVariable('res');

var P = 'resources/engines/anvil/ANVIL0.PAL';
var R = 'resources/engines/anvil/RES.00'+resnum;

getter.loader
.load(R)
.load(P)
.finish(() => {

var createTmpBuffer = function() {
  var buffer = [];
  return function(size:number) {
    if(buffer.length < size){
      buffer = new Array<number>(size);
    }
    for (var i = 0; i < size; i++)
      buffer[i] = 0;
    return buffer;
  }
}();

function createImage(w:number, h:number, data:number[], off:number, trans:number, pal:number[]):void {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  var id = ctx.getImageData(0, 0, w, h);
  var idata = id.data;
  for (var i = 0; i < w*h; i++) {
    var idx = i * 4;
    var col = data[off+i];
    idata[idx + 0] = pal[col*3+0];
    idata[idx + 1] = pal[col*3+1];
    idata[idx + 2] = pal[col*3+2];
    if (col == trans)
      idata[idx + 3] = 0;
    else
      idata[idx + 3] = 255; 
  }
  ctx.putImageData(id, 0, 0); 
  document.body.appendChild(canvas);
}

function LZSS(r:data.DataViewStream, size:number):number[] {
  var ret = createTmpBuffer(size);
  var retoff = 0;

  var blocks = r.readUInt();
  var start = r.readUInt();

  while(retoff < size) { 
    var bits = r.readUShort();
    for (var i = 0; i < 16; i++) {
      var b = (bits >> i) & 1;
      if (b) {
        var _ = r.readUShort();
        var y = (_ >> 13) & 7;
        var x = _ & 0x1fff;
        var off = retoff-2*x;
        for (var o = 0; o < (y+2)*2; o++) {
          ret[retoff++] = ret[off+o];
        }
      } else {
        var _ = r.readUShort();
        ret[retoff++] = _ & 0xff;
        ret[retoff++] = (_>>8) & 0xff;
      }
    }
  }
  return ret;
}

function read(r:data.DataViewStream, size:number, compressed:boolean):number[] {
  if (compressed) {
    return LZSS(r, size);
  } else {
    var ret = createTmpBuffer(size);
    for (var i = 0; i < size; i++)
      ret[i] = r.readUByte();
    return ret;
  }
}

function readFile(r:data.DataViewStream, pal:number[]) {
  var begin = r.mark();
  var sign = r.readByteString(4);
  if (sign != 'D3GR')
    return;

  var flags = r.readUInt();
  var pagesOff = r.readUInt();
  var palOff = r.readUInt();
  var unk0 = r.readUInt();
  var unk1 = r.readUInt();
  var pagesCount = r.readUInt();
  var offsets = new Array<number>(pagesCount);
  for (var i = 0; i < pagesCount; i++)
    offsets[i] = r.readUInt();

  if (palOff != 0) {
    r.setOffset(palOff + begin);
    var pal = pal.slice();
    var colors = r.readUShort();
    var start = r.readUShort()-0x100;
    for (var i = start; i < start+colors; i++){
      pal[i*3+0] = r.readUByte() * 4;
      pal[i*3+1] = r.readUByte() * 4;
      pal[i*3+2] = r.readUByte() * 4;
    }
  }

  for (var i = 0; i < pagesCount; i++) {
    r.setOffset(pagesOff+offsets[i]+begin);

    var size = r.readUInt();
    var type = r.readUInt();
    var compressed = type == 4;
    var left = r.readUShort();
    var top = r.readUShort();
    var h = r.readUShort();
    var w = r.readUShort();

    if (w*h == 0)
      continue;

    var data = read(r, h*w, compressed);
    createImage(w, h, data, 0, 255, pal);
  }
}

function readPal(r:data.DataViewStream, off:number):number[] {
  r.setOffset(off);
  var pal = new Array<number>(256*3);
  for (var i = 0; i < 256; i++){
    pal[i*3+0] = r.readUByte() * 4;
    pal[i*3+1] = r.readUByte() * 4;
    pal[i*3+2] = r.readUByte() * 4;
  }
  return pal;
}

var pal = readPal(new data.DataViewStream(getter.get(P), true), 0);
var res = new data.DataViewStream(getter.get(R), true);
var size = res.readUInt();
console.log("size = " + size);
var offsets = new Array<number>(size);
for (var i = 0; i < size; i++) {
  offsets[i] = res.readUInt();
}

for (var i = 0; i < size-1; i++){
  res.setOffset(offsets[i]);
  readFile(res, pal);
}

});