import D = require('../../../libs/stream');
import U = require('./utils');

export class Pic {
  public pixels: Uint8Array;

  constructor(hs: U.HuffmanStream, w: number, h: number) {
    var vxor = U.verticalXorStream(hs, w);
    this.pixels = new Uint8Array(w * h);
    for (var i = 0; i < w * h; i += 2) {
      var b = vxor.read();
      this.pixels[i] = b >> 4;
      this.pixels[i + 1] = b & 0xf;
    }
  }
}

export class HTDSTileset {
  public pics: Pic[] = [];

  constructor(r: D.Stream) {
    var size = r.readUInt();
    var sign = r.readByteString(3) + r.readUByte();
    if (sign != 'msq0' && sign != 'msq1')
      throw new Error('No msq header found in file');

    var quantity = size * 2 / 16 / 16;
    var huffmanStream = U.huffmanStream(r);
    for (var i = 0; i < quantity; i++) {
      this.pics.push(new Pic(huffmanStream, 16, 16));
    }
  }
}

export class HTDS {
  public tilesets: HTDSTileset[] = [];

  constructor(file: ArrayBuffer) {
    var r = new D.Stream(file, true);
    while (!r.eoi())
      this.tilesets.push(new HTDSTileset(r));
  }
}

export function create(file: ArrayBuffer) {
  return new HTDS(file);
}