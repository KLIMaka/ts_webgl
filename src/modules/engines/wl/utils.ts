import D = require('../../../libs/dataviewstream');
import B = require('../../bitreader');

export class RotatingXorStream {
  private enc:number;
  private endChecksum:number;
  private checksum:number;

  constructor(private stream:D.DataViewStream) {
    var e1 = this.stream.readUByte();
    var e2 = this.stream.readUByte();
    this.enc = e1 ^ e2;
    this.endChecksum = e1 | (e2 << 8);
    this.checksum = 0;
  }

  public read():number {
    var crypted = this.stream.readUByte();
    var b = crypted ^ this.enc;
    this.checksum = (this.checksum - b) & 0xffff;
    this.enc = (this.enc + 0x1f) % 0x100;
    return b;
  }
}

class VerticalXorStream {
  private width:number;
  private lastLine:number[];
  private x:number = 0;
  private y:number = 0;

  constructor(private stream:HuffmanStream, width:number) {
    this.width = width / 2;
    this.lastLine = new Array<number>(width);
  }

  public read():number {
    var b = this.stream.read();

    if (this.y > 0) {
      b = b ^ this.lastLine[this.x];
    }
    this.lastLine[this.x] = b;
    if (this.x < this.width - 1) {
        this.x++;
    } else {
        this.y++;
        this.x = 0;
    }
    return b;
  }
}

export class HuffmanNode {
  public left:HuffmanNode;
  public right:HuffmanNode;
  public data:number = -1;
}

export class HuffmanStream {

  private tree:HuffmanNode;
  private bitstream:B.BitReader;

  constructor(r:D.DataViewStream) {
    this.bitstream = new B.BitReader(r);
    this.tree = this.loadNode(this.bitstream);
  }

  private loadNode(r:B.BitReader):HuffmanNode {
    if (r.readBit() == 0) {
      var left = this.loadNode(r);
      r.readBit();
      var right = this.loadNode(r);
      var node = new HuffmanNode();
      node.left = left;
      node.right = right;
      return node;
    } else {
      var node = new HuffmanNode();
      node.data = r.readBits(8);
      return node;
    }
  }

  public read():number {
    var node = this.tree;
    while (node.data == -1) {
      if(!this.bitstream.readBit())
        node = node.left;
      else
        node = node.right;
    }
    return node.data;
  }

  public readWord():number {
    return this.read() | (this.read() << 8);
  }

  public readData(len:number):Array<number> {
    var data = new Array<number>(len);
    for (var i = 0; i < len; i++) {
      data[i] = this.read();
    }
    return data;
  }
}

export function rotatingXorStream(stream:D.DataViewStream) {
  return new RotatingXorStream(stream);
}

export function verticalXorStream(stream:HuffmanStream, width:number) {
  return new VerticalXorStream(stream, width);
}

export function huffmanStream(stream:D.DataViewStream) {
  return new HuffmanStream(stream);
}


