import data = require('../../../libs/dataviewstream');

export class Header {
  public offsetX:number;
  public offsetY:number;
  public width:number;
  public height:number;
  public type:number;
  public offsetData:number;
}

export class Size {constructor(public width:number, public height:number) {}}

var icnStruct = data.struct(Object, [ 
  ['count', data.ushort],
  ['size', data.uint],
  ['headers', data.structArray(data.val('count'), data.struct(Header, [
    ['offsetX', data.short],
    ['offsetY', data.short],
    ['width', data.ushort],
    ['height', data.ushort],
    ['type', data.ubyte],
    ['offsetData', data.uint]
  ]))]
]);

export class IcnFile {
  private count:number;
  private headers:Header[];
  private globoff:number;

  constructor(private data:data.DataViewStream) {
    this.globoff = this.data.mark();
    var info:any = icnStruct(this.data);
    this.count = info.count;
    this.headers = info.headers;
  }

  public getCount():number {
    return this.count;
  }

  public getFrame(i:number):Uint8Array {
    var h = this.headers[i];
    this.data.setOffset(this.globoff+h.offsetData+6);
    if (h.type == 0x20)
      return renderIcnFrame2(this.data, h.width, h.height);
    else
      return renderIcnFrame1(this.data, h.width, h.height);
  }

  public getInfo(i:number):Header {
    var h = this.headers[i];
    return h;
  }
}

function renderIcnFrame1(data:data.DataViewStream, w:number, h:number):Uint8Array {
  var buf = new Uint8Array(w*h);
  var x = 0;
  var y = 0;
  for(;;) {
    var b = data.readUByte();

    if (b == 0) {
      y++;
      x = 0;
    } else if (b < 0x80) {
      while (b--) buf[y*w+x++] = data.readUByte();
    } else if (b == 0x80) {
      break;
    } else if (b < 0xc0) {
      x += b - 0x80;
    } else if (b == 0xc0) {
      b = data.readUByte();
      var c = (b%4==0) ? data.readUByte() : b%4;
      while (c--) buf[y*w+x++] = 1;
    } else if (b == 0xc1) {
      var c = data.readUByte();
      var i = data.readUByte()
      while (c--) buf[y*w+x++] = i;
    } else {
      var c = b - 0xc0;
      var i = data.readUByte()
      while (c--) buf[y*w+x++] = i;
    }
  }
  return buf;
}

function renderIcnFrame2(data:data.DataViewStream, w:number, h:number):Uint8Array {
  var buf = new Uint8Array(w*h);
  var x = 0;
  var y = 0;
  for(;;) {
    var b = data.readUByte();

    if (b == 0) {
      y++;
      x = 0;
    } else if (b < 0x80) {
      while (b--) buf[y*w+x++] = 1;
    } else if (b == 0x80) {
      break;
    } else {
      x += b - 0x80;
    }
  }
  return buf;
}

export function create(data:data.DataViewStream):IcnFile {
  return new IcnFile(data);
}