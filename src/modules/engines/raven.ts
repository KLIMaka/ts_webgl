import data = require('../../libs/dataviewstream');
import pixel = require('../pixelprovider');

var LZbuf = new Uint8Array(0x1000);

function LZ(r:data.DataViewStream, size:number):Uint8Array {
  var ret = new Uint8Array(size);
  var retoff = 0;
  for (var i = 0; i < 0x0fee; i++)
    LZbuf[i] = 0xfe;

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

function read(r:data.DataViewStream, size:number, mod:number):Uint8Array {
  if (mod == 3) {
    return LZ(r, size);
  } else {
    var ret = new Uint8Array(size);
    for (var i = 0; i < size; i++)
      ret[i] = r.readUByte();
    return ret;
  }
}

function createImage(w:number, h:number, data:Uint8Array, trans:number, pal:number[], isFlip:boolean=false):pixel.PixelProvider {
  var provider:pixel.PixelProvider = new pixel.RGBPalPixelProvider(data, pal, w, h, 255, trans);
  if (isFlip)
    provider = pixel.axisSwap(provider);
  provider = pixel.resize(provider, provider.getWidth()*2, provider.getHeight());
  return provider;
}

function read3dSprite(d:Uint8Array, pal:number[]):pixel.PixelProvider {
  var r = new data.DataViewStream(d.buffer, true);
  var w = r.readUShort();
  var left = r.readUShort();
  var right = r.readUShort();
  var up = r.readUShort();
  var h = r.readUShort();
  var colOffs = new Array<number>(right-left);
  if (colOffs.length == 0)
    return null;
  for (var i = 0; i < colOffs.length; i++)
    colOffs[i] = r.readUShort();
  var img = new Uint8Array(w*h);

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

  return createImage(w, h, img, 254, pal);
}

function readFile(r:data.DataViewStream, pal:number[]):pixel.PixelProvider {
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
        return createImage(w, h, data.subarray(i*w*h, i*w*h+w*h), trans, pal);
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
        return createImage(w, h, data.subarray(i*w*h, i*w*h+w*h), trans, pal);
      break;
    }

    case 5: { //texture
      var mod = r.readUByte();
      var len = r.readUInt();
      var data = read(r, len, mod);
      var cols = data[0] + (data[1]*256);
      return createImage(cols, 0x40, data.subarray(2, len), 254, pal, true);
    }

    case 6: { 
      if (headerSize == 0) {
        //texture
        var len = r.readShort();
        var data = read(r, len, 3);
        return createImage(len/0x40, 0x40, data, 254, pal, true);
      } else {
        // 3D sprite
        var mod = r.readUByte();
        var len = r.readUInt();
        var data = read(r, len, mod);
        return read3dSprite(data, pal);
      }
    }

    case 7: {
      if (headerSize == 0) {
        // 3D sprite
        var len = r.readUShort();
        var data = read(r, len, 3);
        return read3dSprite(data, pal);
      }
    }

    default: {
      console.log('type='+type);
      return null;
    }
  }
}

export class RavenPals {

  private pal:data.DataViewStream;
  private count:number;

  constructor(palbuf:ArrayBuffer) {
    this.pal = new data.DataViewStream(palbuf, true);
    this.count = this.pal.readUByte();
  }

  public get(i:number):number[] {
    var p = new Array<number>(256*3);
    this.readPal(i, p);
    return p;
  }

  public readPal(i:number, p:number[]):void {
    if (i >= this.count)
      throw new Error('No pal ' + i);
    this.pal.setOffset(i*768 + 1);
    for (var i = 0; i < 255; i++){
      p[i*3+0] = this.pal.readUByte() * 4;
      p[i*3+1] = this.pal.readUByte() * 4;
      p[i*3+2] = this.pal.readUByte() * 4;
    }
  }
}

export class RavenRes {

  private res:data.DataViewStream;
  private count:number;
  private offsets:number[];

  constructor (resbuf:ArrayBuffer) {
    var res = new data.DataViewStream(resbuf, true);
    var count = res.readUInt();
    var offsets = new Array<number>(count);
    for (var i = 0; i < count; i++) {
      offsets[i] = res.readUInt();
    }

    this.res = res;
    this.count = count;
    this.offsets = offsets;
  }

  public get(i:number, pal:number[]):pixel.PixelProvider {
    if (i >= this.count)
      throw new Error('No res ' + i);
    this.res.setOffset(this.offsets[i]);
    return readFile(this.res, pal);
  }

  public size() {
    return this.count;
  }
}