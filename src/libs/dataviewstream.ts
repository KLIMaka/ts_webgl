export class DataViewStream {
  private view: DataView;
  private offset: number;
  private littleEndian: boolean;
  private currentBit = 7;
  private currentByte = 0;

  constructor(buf: ArrayBuffer, isLE: boolean) {
    this.view = new DataView(buf);
    this.offset = 0;
    this.littleEndian = isLE;
  }

  private checkBitAlignment() {
    if (this.currentBit != 7)
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

  public readBit(reverse: boolean = true): number {
    if (this.currentBit > 6) {
      this.currentByte = this.readUByte();
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

  public readBits(bits: number, reverse: boolean = true): number {
    let value = 0;
    let signed = bits < 0;
    bits = signed ? -bits : bits;
    for (let i = 0; i < bits; i++) {
      let b = this.readBit(reverse);
      value = reverse ? value | (b << i) : (value << 1) | b;
    }
    return signed ? toSigned(value, bits) : value;
  }
}

function toSigned(value: number, bits: number) {
  return value & (1 << (bits - 1))
    ? -(~value & ((1 << bits) - 1)) - 1
    : value
}

type ScalarReader<T> = (s: DataViewStream) => T;
type AtomicArrayConstructor<T> = { new(buffer: ArrayBuffer, byteOffset: number, length: number): T };

export interface Reader<T, AT> {
  readonly read: ScalarReader<T>;
  readonly size: number;
  readonly atomicArrayFactory: AtomicArrayConstructor<AT>;
}

function reader<T, AT>(read: ScalarReader<T>, size: number, atomicArrayFactory: AtomicArrayConstructor<AT> = null) {
  return { read, size, atomicArrayFactory };
}

export const byte = reader(s => s.readByte(), 1, Int8Array);
export const ubyte = reader(s => s.readUByte(), 1, Uint8Array);
export const short = reader(s => s.readShort(), 2, Int16Array);
export const ushort = reader(s => s.readUShort(), 2, Uint16Array);
export const int = reader(s => s.readInt(), 4, Int32Array);
export const uint = reader(s => s.readUInt(), 4, Uint32Array);
export const float = reader(s => s.readFloat(), 4, Float32Array);
export const string = (len: number) => reader(s => s.readByteString(len), len);
export const bits = (len: number) => reader(s => s.readBits(len), len / 8);
export const array = <T>(type: Reader<T, any>, len: number) => reader(s => readArray(s, type, len), type.size * len);
export const atomic_array = <T>(type: Reader<any, T>, len: number) => reader(s => readAtomicArray(s, type, len), type.size * len);
export const struct = <T>(type: Constructor<T>, fields: Field[]) => reader(s => readStruct(s, fields, type), fields.reduce((l, r) => l + r[1].size, 0));

let readArray = <T>(s: DataViewStream, type: Reader<T, any>, len: number): Array<T> => {
  let arr = new Array<T>();
  for (let i = 0; i < len; i++)
    arr[i] = type.read(s);
  return arr;
}

let readAtomicArray = <T>(s: DataViewStream, type: Reader<any, T>, len: number): T => {
  let factory = type.atomicArrayFactory;
  if (factory == null)
    throw new Error('type is not atomic');
  let array = s.array(len * type.size);
  return new factory(array, 0, len * type.size);
}

type Constructor<T> = { new(): T };
type Field = [string, Reader<any, any>];
let readStruct = <T>(s: DataViewStream, fields: Field[], type: Constructor<T>): T => {
  let struct = new type();
  for (let i = 0; i < fields.length; i++) {
    let [name, reader] = fields[i];
    struct[name] = reader.read(s);
  };
  return struct;
}

