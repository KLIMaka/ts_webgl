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

export class ValueResolver {
  constructor(private name:string) {}
  get(locals:any):any {return locals[this.name]}
}
export function val(name:string) {return new ValueResolver(name)}
function get(val:any, locals:any) {return val instanceof ValueResolver ? val.get(locals) : val}

export var byte = (s:DataViewStream, locals:any={}) => s.readByte();
export var ubyte = (s:DataViewStream, locals:any={}) => s.readUByte();
export var short = (s:DataViewStream, locals:any={}) => s.readShort();
export var ushort = (s:DataViewStream, locals:any={}) => s.readUShort();
export var int = (s:DataViewStream, locals:any={}) => s.readInt();
export var uint = (s:DataViewStream, locals:any={}) => s.readUInt();
export var float = (s:DataViewStream, locals:any={}) => s.readFloat();
var arrayTypes:any = {};
arrayTypes[byte] = Int8Array;
arrayTypes[ubyte] = Uint8Array;
arrayTypes[short] = Int16Array;
arrayTypes[ushort] = Uint16Array;
arrayTypes[int] = Int32Array;
arrayTypes[uint] = Uint32Array;
arrayTypes[float] = Float32Array;

export var string_ = (s:DataViewStream, len:number) => s.readByteString(len);
export var string = (len:any) => {return (s:DataViewStream, locals:any={}) => string_(s, get(len,locals))};

export var array_ = (s:DataViewStream, type:any, len:number) => {
  var arrayType = arrayTypes[type];
  if (s.mark() % arrayType.BYTES_PER_ELEMENT != 0) {
    var arr = new Array(len);
    for (var i = 0; i < len; i++)
      arr[i] = type(s);
    return new arrayType(arr);
  } else {
    var tarr = new arrayType(s.buffer(), s.mark(), len); 
    s.skip(len*arrayType.BYTES_PER_ELEMENT); 
    return tarr;
  }
}
export var array = (type:any, len:any) => {return (s:DataViewStream, locals:any={}) => array_(s, get(type,locals), get(len,locals))};

export var structArray_ = (s:DataViewStream, struct:any, len:number, locals:any={}) => {var arr = []; for(var i = 0; i < len; i++) arr[i] = struct(s, locals); return arr;}
export var structArray = (len:any, struct:any) => {return (s:DataViewStream, locals:any={}) => structArray_(s, get(struct,locals), get(len,locals), locals)}

export var struct_ = (s:DataViewStream, fields:any, type:any, locals:any={}) => {
  var struct = new type();
  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    struct[field[0]] = field[1](s, struct);
  }
  return struct;
};
export var struct = (type:any, fields:any) => {return (s:DataViewStream, locals:any={}) => struct_(s, get(fields,locals), get(type,locals), locals)};