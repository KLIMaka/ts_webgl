import D = require('../../../libs/stream');
import B = require('../../bitreader');

export class Strings {

  public strings: string[] = [];

  constructor(r: D.Stream, end: number) {
    var start = r.mark();
    var charTable = new Array<number>(60);
    for (var i = 60; i > 0; i--)
      charTable[60 - i] = r.readUByte();
    var tmp = r.readUShort();
    var quantity = tmp / 2;
    var stringOffsets = new Array<number>();
    stringOffsets.push(tmp);
    for (var i = 1; i < quantity; i++) {
      tmp = r.readUShort();
      if ((tmp + start + 60 >= end) || (tmp < stringOffsets[i - 1])) {
        if (i == quantity - 1) {
          continue;
        } else {
          throw new Error("Error parsing strings");
        }
      }
      stringOffsets.push(tmp);
    }
    for (var i = 0; i < stringOffsets.length; i++) {
      r.setOffset(stringOffsets[i] + 60 + start);
      this.readStringGroup(r, charTable, end);
    }
  }

  private readStringGroup(r: D.Stream, charTable: number[], end: number): void {
    var bitStream = new B.BitReader(r);
    for (var j = 0; j < 4; j++) {
      var upper = false;
      var high = false;
      var str = '';
      outer: while (true) {
        if (r.mark() > end)
          return;
        var index = bitStream.readBits(5, true);
        switch (index) {
          case 0x1f:
            high = true;
            break;
          case 0x1e:
            upper = true;
            break;
          default:
            var char_ = charTable[index + (high ? 0x1e : 0)];
            if (char_ == 0) break outer;
            var s = String.fromCharCode(char_);
            if (upper)
              s = s.toUpperCase();
            str += s;
            upper = false;
            high = false;
        }
      }
      this.strings.push(str);
    }
  }
}