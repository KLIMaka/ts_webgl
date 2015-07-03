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

  public array(bytes:number) {
    return new DataView(this.view.buffer, this.offset, bytes)
  }
}

export interface Reader<T> {
  read(s:DataViewStream):T;
  sizeof():number;
  arrType():any;
}

export class BasicReader<T> implements Reader<T> {
  constructor(private f:(s:DataViewStream)=>T, private size:number, private arr) {}
  read(s:DataViewStream):T {return this.f(s)}
  sizeof():number {return this.size}
  arrType():any {return this.arr}
}

export function reader<T>(rf:(s:DataViewStream)=>T, size:number, arr:any=null) {
  return new BasicReader<T>(rf, size, arr);
}

export var byte = reader((s:DataViewStream) => s.readByte(), 1, Int8Array);
export var ubyte = reader((s:DataViewStream) => s.readUByte(), 1, Uint8Array);
export var short = reader((s:DataViewStream) => s.readShort(), 2, Int16Array);
export var ushort = reader((s:DataViewStream) => s.readUShort(), 2, Uint16Array);
export var int = reader((s:DataViewStream) => s.readInt(), 4, Int32Array);
export var uint = reader((s:DataViewStream) => s.readUInt(), 4, Uint32Array);
export var float = reader((s:DataViewStream) => s.readFloat(), 4, Float32Array);
export var string = (len:any) => {return reader((s:DataViewStream) => s.readByteString(len), len)};

export var array_ = (s:DataViewStream, type:any, len:number) => {
  var arrayType = type.arrType();
  if (arrayType == null) {
    var arr = []; 
    for(var i = 0; i < len; i++) 
      arr[i] = type.read(s); 
    return arr;
  }
  var arr = new Array(len);
  for (var i = 0; i < len; i++)
    arr[i] = type.read(s);
  return new arrayType(arr);
}
export var array = (type:any, len:number) => {return reader((s:DataViewStream) => array_(s, type, len), type.sizeof()*len)};

export var struct_ = (s:DataViewStream, fields:any, type:any) => {
  var struct = new type();
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    struct[field[0]] = field[1].read(s);
  }
  return struct;
};
export var struct = (type:any, fields:any) => {return reader((s:DataViewStream) => struct_(s, fields, type), fields.reduce((l,r) => l+r[1].sizeof(), 0))};
