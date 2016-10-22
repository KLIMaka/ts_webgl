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

export interface Reader<T, AT> {
  read(s:DataViewStream):T;
  sizeof():number;
  arrType():{new(T):AT};
}

export class BasicReader<T, AT> implements Reader<T, AT> {
  constructor(private f:(s:DataViewStream)=>T, private size:number, private arr:{new(T):AT}) {}
  read(s:DataViewStream):T {return this.f(s)}
  sizeof():number {return this.size}
  arrType():{new(T):AT} {return this.arr}
}

export function reader<T,AT>(rf:(s:DataViewStream)=>T, size:number, arr:{new(T):AT}=null) {
  return new BasicReader<T,AT>(rf, size, arr);

}
export var byte = reader((s:DataViewStream) => s.readByte(), 1, Int8Array);
export var ubyte = reader((s:DataViewStream) => s.readUByte(), 1, Uint8Array);
export var short = reader((s:DataViewStream) => s.readShort(), 2, Int16Array);
export var ushort = reader((s:DataViewStream) => s.readUShort(), 2, Uint16Array);
export var int = reader((s:DataViewStream) => s.readInt(), 4, Int32Array);
export var uint = reader((s:DataViewStream) => s.readUInt(), 4, Uint32Array);
export var float = reader((s:DataViewStream) => s.readFloat(), 4, Float32Array);
export var string = (len:any) => {return reader((s:DataViewStream) => s.readByteString(len), len)};

export var array_ = <T, AT>(s:DataViewStream, type:Reader<T, AT>, len:number):Array<T> => {
  var arrayType = type.arrType();
  var arr = new Array<T>(); 
  for(var i = 0; i < len; i++) 
    arr[i] = type.read(s); 
  return arr;
}
export var array = <T,AT>(type:Reader<T,AT>, len:number) => {return reader((s:DataViewStream) => array_(s, type, len), type.sizeof()*len)};

export var atomic_array_ = <T, AT>(s:DataViewStream, type:Reader<T, AT>, len:number):AT => {
  var arrayType = type.arrType();
  if (arrayType == null)
    throw new Error('type is not atomic');
  var arr = new Array<T>(len);
  for (var i = 0; i < len; i++)
    arr[i] = type.read(s);
  return new arrayType(arr);
}
export var atomic_array = <T,AT>(type:Reader<T,AT>, len:number) => {return reader((s:DataViewStream) => atomic_array_(s, type, len), type.sizeof()*len)};

export var struct_ = <T>(s:DataViewStream, fields:any, type:{new(): T}):T => {
  var struct = new type();
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    struct[field[0]] = field[1].read(s);
  }
  return struct;
};
export var struct = <T>(type:{new():T}, fields:any) => {return reader((s:DataViewStream) => struct_(s, fields, type), fields.reduce((l,r) => l+r[1].sizeof(), 0))};
