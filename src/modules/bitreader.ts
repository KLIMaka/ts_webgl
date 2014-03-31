
import data = require('../libs/dataviewstream');

export class BitReader {
  
  private availBits = 0;
  private bits = 0;

  constructor(private data:data.DataViewStream) {
    this.data = data;
    this.mask = this.getMask(this.bitlength);
  }

  public read(bits:number):number {
    while (this.availBits < bits) {
      this.bits = ((this.bits & this.getMask(this.availBits)) << 8) | this.data.readUByte();
      this.availBits += 8;
    }

    var ret = this.getBits();
    this.availBits -= bits;
    return ret;
  }

  private getMask(bits):number {
    return (1 << bits) - 1;
  }

  private getBits(bits:number):number {
    return (this.bits >> (this.availBits - this.bits)) & this.getMask(bits);
  }
}

export class NibbleReader extends BitReader {

  constructor(data:data.DataViewStream, private nibblesize:number) {
    super(data);
  }

  public readNibble() {
    return this.read(this.nibblesize);
  }
}