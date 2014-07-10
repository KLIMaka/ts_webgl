export class DataViewStream {
  private view:DataView;
  private offset:number;
  private littleEndian:boolean;

  constructor(buf:ArrayBuffer, isLE:boolean) {
    this.view = new DataView(buf);
    this.offset = 0;
    this.littleEndian = isLE;
  }

  public eoi():boolean {
    return this.offset >= this.view.byteLength;
  }

  public skip(n:number) {
    this.offset += n;
  }

  public setOffset(off:number):void {
    this.offset = off;
  }

  public mark():number {
    return this.offset;
  }

  public readByte():number {
    return this.view.getInt8(this.offset++);
  }

  public readUByte():number {
    return this.view.getUint8(this.offset++);
  }

  public readShort():number {
    var ret = this.view.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return ret;
  }

  public readUShort():number {
    var ret = this.view.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return ret;
  }

  public readInt():number {
    var ret = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public readUInt():number {
    var ret = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public readFloat():number {
    var ret = this.view.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public readByteString(len:number):string{
    var str = new Array<string>(len);
    for (var i = 0; i < len; i++) {
      str[i] = String.fromCharCode(this.readByte());
    }
    return str.join('');
  }

  public subView():DataViewStream {
    var ret =  new DataViewStream(this.view.buffer, this.littleEndian);
    ret.setOffset(this.offset);
    return ret;
  }
}