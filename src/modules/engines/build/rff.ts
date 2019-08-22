import { struct, string, uint, array, byte, ubyte, DataViewStream, atomic_array } from "../../../libs/dataviewstream";

let headerStruct = struct(Object, [
  ['sign', string(4)],
  ['version', uint],
  ['offFat', uint],
  ['numFiles', uint]
]);
let fatRecord = struct(Object, [
  ['_', array(byte, 16)],
  ['offset', uint],
  ['size', uint],
  ['_', uint],
  ['time', uint],
  ['flags', ubyte],
  ['filename', string(11)],
  ['_', uint]
]);

export class RffFile {

  private data: DataViewStream;
  private header: any;
  public fat: any;
  private namesTable = {};

  constructor(buf: ArrayBuffer) {
    this.data = new DataViewStream(buf, true);
    this.header = headerStruct.read(this.data);
    this.data.setOffset(this.header.offFat);
    let len = this.header.numFiles * 48;
    let fat = atomic_array(ubyte, len).read(this.data);
    this.decodeFat(fat, this.header);
    let fatBuffer = new DataViewStream(fat.buffer, true);
    fatBuffer.setOffset(fat.byteOffset);
    this.loadFat(fatBuffer, this.header.numFiles);
  }

  private loadFat(stream: DataViewStream, numFiles: number): void {
    this.fat = array(fatRecord, numFiles).read(stream);
    for (let i in this.fat) {
      let r = this.fat[i];
      r.filename = this.convertFname(r.filename);
      this.namesTable[r.filename] = i;
    }
  }

  private decodeFat(fat: Uint8Array, header: any) {
    if (this.header.version >= 0x301) {
      let key = this.header.offFat & 0xff;
      for (let i = 0; i < fat.length; i += 2) {
        fat[i] ^= key;
        fat[i + 1] ^= key;
        key = (key + 1) % 256;
      }
    }
  }

  private convertFname(name: string): string {
    return name.substr(3) + '.' + name.substr(0, 3);
  }

  public get(fname: string): Uint8Array {
    let record = this.fat[this.namesTable[fname]];
    this.data.setOffset(record.offset);
    let arr = atomic_array(ubyte, record.size).read(this.data);
    if (record.flags & 0x10)
      for (let i = 0; i < 256; i++)
        arr[i] ^= (i >> 1);
    return arr;
  }
}

export function create(buf: ArrayBuffer): RffFile {
  return new RffFile(buf);
}