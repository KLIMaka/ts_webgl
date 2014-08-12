export class DataViewStream {
  private view:DataView;
  private offset:number;
  private littleEndian:boolean;

  constructor(buf:ArrayBuffer, isLE:boolean) {
    this.view = new DataView(buf);
    this.offset = 0;
    this.littleEndian = isLE;
  }

  public buffer():ArrayBuffer {
    return this.view.buffer;
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
      var c = this.readByte();
      if (c == 0){
        this.skip(len-i-1);
        break;
      }
      str[i] = String.fromCharCode(c);
    }
    return str.join('');
  }

  public subView():DataViewStream {
    var ret =  new DataViewStream(this.view.buffer, this.littleEndian);
    ret.setOffset(this.offset);
    return ret;
  }
}

export var byte = (s:DataViewStream) => s.readByte();
export var ubyte = (s:DataViewStream) => s.readUByte();
export var short = (s:DataViewStream) => s.readShort();
export var ushort = (s:DataViewStream) => s.readUShort();
export var int = (s:DataViewStream) => s.readInt();
export var uint = (s:DataViewStream) => s.readUInt();
export var float = (s:DataViewStream) => s.readFloat();
export var string = (s:DataViewStream, len:number) => s.readByteString(len);
export var stringCreator = (len:number) => {return (s:DataViewStream) => string(s, len)};
export var array = (s:DataViewStream, type:any, len:number) => {var arr = new type(s.buffer(), s.mark(), len); s.skip(len*type.BYTES_PER_ELEMENT); return arr;}
export var arrayCreator = (type:any, len:number) => {return (s:DataViewStream) => array(s, type, len)};

export var struct = (s:DataViewStream, fields:any, type:any) => {
  var struct = new type();
  for (var i in fields) {
    var field = fields[i];
    struct[field[0]] = field[1](s);
  }
  return struct;
};
export var structCreator = (type:any, fields:any) => {return (s:DataViewStream) => struct(s, fields, type)};