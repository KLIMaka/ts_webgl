import * as data from '../libs/dataviewstream';

function toSigned(value:number, bits:number) {
  return value & (1 << (bits-1)) 
    ? -(~value & ((1 << bits) - 1)) - 1
    : value
}

export class BitReader {
  
  private currentBit = 7;
  private currentByte = 0;

  constructor(private data:data.DataViewStream) {
    this.data = data;
  }

  public readBit(reverse:boolean=false):number {
    if (this.currentBit > 6) {
      this.currentByte = this.read();
      this.currentBit = 0;
    } else {
      this.currentBit++;
    }

    if (reverse) {
      return ((this.currentByte >> (this.currentBit)) & 1);
    } else {
      return ((this.currentByte >> (7 - this.currentBit)) & 1);
    }
  }

  public read():number {
    return this.data.readUByte();
  }

  public readBits(bits:number, reverse:boolean=false):number {
    var value = 0;
    var signed = bits < 0;
    bits = signed ? -bits : bits;
    for (var i = 0; i < bits; i++) {
      var b = this.readBit(reverse);
      if (reverse) {
        value = value | (b << i);
      } else {
        value = (value << 1) | b;
      }
    }
    return signed ? toSigned(value, bits) : value;
  }
}