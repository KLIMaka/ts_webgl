import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import browser = require('./libs/browser');

var resnum = browser.getQueryVariable('res');

var P = 'resources/engines/raven1/COLORS';
var R = 'resources/engines/raven1/RES'+resnum;

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

var LZbuf = new Array<number>(0x1000);
function LZ(r:data.DataViewStream, size:number):number[] {
  var ret = createTmpBuffer(size);
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
  return ret;
}

function read(r:data.DataViewStream, size:number, mod:number):number[] {
  if (mod == 3) {
    return LZ(r, size);
  } else {
    var ret = createTmpBuffer(size);
    for (var i = 0; i < size; i++)
      ret[i] = r.readUByte();
    return ret;
  }
}

function flip(data:number[], off:number, w:number, h:number):number[] {
  var ret = new Array<number>(w*h);
  var i = 0;
  for (var x = 0; x < w; x++) {
    for (var y = 0; y < h; y++) {
      ret[x+y*w] = data[off + i++];
    }
  }
  return ret;
}

function createImage(w:number, h:number, data:number[], off:number, trans:number, pal:number[], dw:boolean=true, isFlip:boolean=false):void {
  if (isFlip) {
    var tmp = h;
    h = w;
    w = tmp;
    data = flip(data, off, w, h);
    off = 0;
  }
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = dw?w*2:w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  var id = ctx.getImageData(0, 0, dw?w*2:w, h);
  var idata = id.data;
  for (var i = 0; i < w*h; i++) {
    var idx = i * 4 * (dw?2:1);
    var col = data[off+i];
    idata[idx + 0] = pal[col*3+0];
    idata[idx + 1] = pal[col*3+1];
    idata[idx + 2] = pal[col*3+2];
    if (col == trans)
      idata[idx + 3] = 0;
    else
      idata[idx + 3] = 255; 
    if (dw) {
      idata[idx + 4] = pal[col*3+0];
      idata[idx + 5] = pal[col*3+1];
      idata[idx + 6] = pal[col*3+2];
      if (col == trans)
        idata[idx + 7] = 0;
      else
        idata[idx + 7] = 255;
    }
  }
  ctx.putImageData(id, 0, 0); 
  document.body.appendChild(canvas);
}

function read3dSprite(d:number[], pal:number[]) {
  var arr = new Uint8Array(d);
  var r = new data.DataViewStream(arr.buffer, true);
  var w = r.readUShort();
  var left = r.readUShort()-1;
  var right = r.readUShort();
  var up = r.readUShort();
  var h = r.readUShort();
  var colOffs = new Array<number>(right-left);
  for (var i = 0; i < colOffs.length; i++)
    colOffs[i] = r.readUShort();
  var img = createTmpBuffer(w*h);

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

  createImage(w, h, img, 0, 0, pal);
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
        createImage(w, h, data, i*w*h, trans, pal);

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
        createImage(w, h, data, i*w*h, trans, pal);

      console.log('font x'+imgnum + ' w:'+w+' h:'+h+' mod:'+mod);
      break;
    }

    case 6: { //texture
      var len = r.readUShort();
      var data = LZ(r, len);
      createImage(len/0x40, 0x40, data, 0, 0, pal, true, true);
      break;
    }

    case 7: { //3D sprite
      var len = r.readUShort();
      var data = LZ(r, len);
      read3dSprite(data, pal);
      break;
    }

    default: {
      // throw new Error('Wrong type');
      console.log('type = ' + type);
    }
  }
}

function readPal(r:data.DataViewStream, off:number):number[] {
  r.setOffset(off);
  var pal = new Array<number>(256*3);
  for (var i = 0; i < 255; i++){
    pal[i*3+2] = r.readUByte() * 4;
    pal[i*3+0] = r.readUByte() * 4;
    pal[i*3+1] = r.readUByte() * 4;
  }
  return pal;
}

var start = new Date().getTime();

var palnum = browser.getQueryVariable('pal');
var pal = readPal(new data.DataViewStream(getter.get(P), true), 256*3*palnum);
var res = new data.DataViewStream(getter.get(R), true);
var size = res.readUInt();
// console.log("size = " + size);
var offsets = new Array<number>(size);
for (var i = 0; i < size; i++) {
  offsets[i] = res.readUInt();
}

for (var i = 0; i < size-1; i++){
  res.setOffset(offsets[i]);
  readFile(res,pal);
  // console.log(i);
}

alert('elapsed '+ (((new Date).getTime() - start)/1000) + 's');

});