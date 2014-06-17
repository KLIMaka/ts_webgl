import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');

function getQueryVariable(variable):any
{
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i=0;i<vars.length;i++) {
    var pair = vars[i].split("=");
    if(pair[0] == variable){
      return pair[1];
    }
  }
  return(false);
}
var resnum = getQueryVariable('res');
var prev = document.createElement('a');
prev.href='?res='+((resnum|0)+1);
prev.innerText = 'Next';
document.body.appendChild(prev);

var P = 'resources/raven2/COLORS';
var R = 'resources/raven2/RES'+resnum;

getter.loader
.load(R)
.load(P)
.finish(() => {

function LZ(r:data.DataViewStream, size:number):number[] {
  var ret = [];
  var buf = new Array<number>(0x1000);
  for (var i = 0; i < 0x0fee; i++) {
    buf[i] = 0xfe;
  }
  var off = 0x0fee;


  while(ret.length < size) {
    var bits = r.readUByte();
    for (var i = 0; i < 8; i++) {
      var b = (bits >> i) & 1;
      if (b == 1) {
        var _ = r.readUByte();
        ret.push(_);
        buf[off] = _;
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
          var _ = buf[(xzt+j) % 0x1000];
          ret.push(_);
          buf[off] = _;
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
    var ret = Array<number>(size);
    for (var i = 0; i < size; i++)
      ret[i] = r.readUByte();
    return ret;
  }
}

function createImg(w:number, h:number, data:number[]) {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var ctx = canvas.getContext('2d');
  var id = ctx.createImageData(w, h);
  var idata = id.data;
  for (var i = 0; i < w*h*4; i++) {
    idata[i] = data[i]
  }
  ctx.putImageData(id, 0, 0); 
  document.body.appendChild(canvas);
}

function createImageData(w:number, h:number, data:number[], off:number, trans:number, pal:number[]):number[] {
  var idata = new Array<number>(w*h*4);
  for (var i = 0; i < w*h; i++) {
    var idx = i * 4;
    var col = data[off+i] * 3;
    idata[idx + 0] = pal[col+0];
    idata[idx + 1] = pal[col+1];
    idata[idx + 2] = pal[col+2];
    idata[idx + 3] = 255;
  }
  return idata;
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

      var data = read(r,  imgnum*w*h, mod);
      for (var i = 0; i < imgnum; i++)
        createImg(w, h, createImageData(w, h, data, i*w*h, trans, pal));

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

      var data = read(r,  imgnum*w*h, mod);
      for (var i = 0; i < imgnum; i++)
        createImg(w, h, createImageData(w, h, data, i*w*h, trans, pal));

      console.log('font x'+imgnum + ' w:'+w+' h:'+h+' mod:'+mod);
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
  for (var i = 0; i < 256; i++){
    pal[i*3+2] = r.readUByte() * 4;
    pal[i*3+0] = r.readUByte() * 4;
    pal[i*3+1] = r.readUByte() * 4;
  }
  return pal;
}

var pal = readPal(new data.DataViewStream(getter.get(P), true), 256*3*getQueryVariable('pal') );
var res = new data.DataViewStream(getter.get(R), true);
var size = res.readUInt();
console.log("size = " + size);
for (var i = 0; i < size-1; i++) {
  var off = res.readUInt();
  var mark = res.mark();
  res.setOffset(off);
  readFile(res, pal);
  res.setOffset(mark);
}

});