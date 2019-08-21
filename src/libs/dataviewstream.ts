import { BitReader } from "../modules/bitreader";

export class DataViewStream {
  private view: DataView;
  private offset: number;
  private littleEndian: boolean;
  private bitReader: BitReader;

  constructor(buf: ArrayBuffer, isLE: boolean) {
    this.view = new DataView(buf);
    this.offset = 0;
    this.littleEndian = isLE;
    this.bitReader = new BitReader(this);
  }

  private checkBitAlignment() {
    if (!this.bitReader.isAligned())
      throw new Error('Unaligned read');
  }

  public buffer(): ArrayBuffer {
    return this.view.buffer;
  }

  public eoi(): boolean {
    return this.offset >= this.view.byteLength;
  }

  public skip(n: number) {
    this.checkBitAlignment();
    this.offset += n;
  }

  public setOffset(off: number): void {
    this.checkBitAlignment();
    this.offset = off;
  }

  public mark(): number {
    this.checkBitAlignment();
    return this.offset;
  }

  public readByte(): number {
    this.checkBitAlignment();
    return this.view.getInt8(this.offset++);
  }

  public readUByte(): number {
    this.checkBitAlignment();
    return this.view.getUint8(this.offset++);
  }

  public readShort(): number {
    this.checkBitAlignment();
    let ret = this.view.getInt16(this.offset, this.littleEndian);
    this.offset += 2;
    return ret;
  }

  public readUShort(): number {
    this.checkBitAlignment();
    let ret = this.view.getUint16(this.offset, this.littleEndian);
    this.offset += 2;
    return ret;
  }

  public readInt(): number {
    this.checkBitAlignment();
    let ret = this.view.getInt32(this.offset, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public readUInt(): number {
    this.checkBitAlignment();
    let ret = this.view.getUint32(this.offset, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public readFloat(): number {
    this.checkBitAlignment();
    let ret = this.view.getFloat32(this.offset, this.littleEndian);
    this.offset += 4;
    return ret;
  }

  public readByteString(len: number): string {
    this.checkBitAlignment();
    let str = new Array<string>(len);
    for (let i = 0; i < len; i++) {
      let c = this.readByte();
      if (c == 0) {
        this.skip(len - i - 1);
        break;
      }
      str[i] = String.fromCharCode(c);
    }
    return str.join('');
  }

  public subView(): DataViewStream {
    this.checkBitAlignment();
    let ret = new DataViewStream(this.view.buffer, this.littleEndian);
    ret.setOffset(this.offset);
    return ret;
  }

  public array(bytes: number): ArrayBuffer {
    this.checkBitAlignment();
    let slice = this.view.buffer.slice(this.offset, this.offset + bytes);
    this.offset += bytes;
    return slice;
  }

  public readBits(bits: number, reverse: boolean): number {
    return this.bitReader.readBits(bits, reverse);
  }
}

export interface Reader<T, AT> {
  read(s: DataViewStream): T;
  sizeof(): number;
  arrType(): { new(buffer: ArrayBuffer, byteOffset: number, length: number): AT };
}

export class BasicReader<T, AT> implements Reader<T, AT> {
  constructor(private f: (s: DataViewStream) => T, private size: number, private arr: { new(T): AT }) { }
  read(s: DataViewStream): T { return this.f(s) }
  sizeof(): number { return this.size }
  arrType(): { new(buffer: ArrayBuffer, byteOffset: number, length: number): AT } { return this.arr }
}

export function reader<T, AT>(rf: (s: DataViewStream) => T, size: number, arr: { new(T): AT } = null) {
  return new BasicReader<T, AT>(rf, size, arr);
}

export const byte = reader(s => s.readByte(), 1, Int8Array);
export const ubyte = reader(s => s.readUByte(), 1, Uint8Array);
export const short = reader(s => s.readShort(), 2, Int16Array);
export const ushort = reader(s => s.readUShort(), 2, Uint16Array);
export const int = reader(s => s.readInt(), 4, Int32Array);
export const uint = reader(s => s.readUInt(), 4, Uint32Array);
export const float = reader(s => s.readFloat(), 4, Float32Array);
export const string = (len: number) => { return reader(s => s.readByteString(len), len) };
export const bits = (len: number, reverse: boolean = true) => { return reader(s => s.readBits(len, reverse), len / 8) };

let array_ = <T, AT>(s: DataViewStream, type: Reader<T, AT>, len: number): Array<T> => {
  let arr = new Array<T>();
  for (let i = 0; i < len; i++)
    arr[i] = type.read(s);
  return arr;
}
export const array = <T, AT>(type: Reader<T, AT>, len: number) => { return reader((s: DataViewStream) => array_(s, type, len), type.sizeof() * len) };

let atomic_array_ = <T, AT>(s: DataViewStream, type: Reader<T, AT>, len: number): AT => {
  let arrayType = type.arrType();
  if (arrayType == null)
    throw new Error('type is not atomic');
  let array = s.array(len * type.sizeof());
  return new arrayType(array, 0, len * type.sizeof());
}
export const atomic_array = <T, AT>(type: Reader<T, AT>, len: number) => { return reader((s: DataViewStream) => atomic_array_(s, type, len), type.sizeof() * len) };

let struct_ = <T>(s: DataViewStream, fields: Field[], type: Constructor<T>): T => {
  let struct = new type();
  for (let i = 0; i < fields.length; i++) {
    let [name, reader] = fields[i];
    let parts = name.split(',');
    if (parts.length == 1) {
      struct[name] = reader.read(s);
    } else {
      let values = reader.read(s);
      for (let r = 0; r < parts.length; r++) {
        let pname = parts[r];
        struct[pname] = values[r];
      }
    }
  }
  return struct;
};

type Constructor<T> = { new(): T };
type Field = [string, Reader<any, any>];
export const struct = <T>(type: Constructor<T>, fields: Field[]) => { return reader((s: DataViewStream) => struct_(s, fields, type), fields.reduce((l, r) => l + r[1].sizeof(), 0)) };
