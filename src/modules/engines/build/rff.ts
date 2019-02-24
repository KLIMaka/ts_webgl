import * as data  from '../../../libs/dataviewstream';

var headerStruct = data.struct(Object, [
  ['sign', data.string(4)],
  ['version', data.uint],
  ['offFat', data.uint],
  ['numFiles', data.uint]
]);
var fatRecord = data.struct(Object, [
  ['_', data.array(data.byte, 16)],
  ['offset', data.uint],
  ['size', data.uint],
  ['_', data.uint],
  ['time', data.uint],
  ['flags', data.ubyte],
  ['filename', data.string(11)],
  ['_', data.uint]
]);

export class RffFile {

  private data:data.DataViewStream;
  private header;
  public fat;
  private namesTable = {};

  constructor(buf:ArrayBuffer) {
    this.data = new data.DataViewStream(buf, true);
    this.header = headerStruct.read(this.data);
    this.data.setOffset(this.header.offFat);
    var len = this.header.numFiles * 48;
    var fat = data.atomic_array(data.ubyte, len).read(this.data);
    this.decodeFat(fat, this.header);
    var fatBuffer = new data.DataViewStream(fat.buffer, true);
    fatBuffer.setOffset(fat.byteOffset);
    this.loadFat(fatBuffer, this.header.numFiles);
  }

  private loadFat(stream:data.DataViewStream, numFiles:number):void {
    this.fat = data.array(fatRecord, numFiles).read(stream);
    for (var i in this.fat) {
      var r = this.fat[i];
      r.filename = this.convertFname(r.filename);
      this.namesTable[r.filename] = i;
    }
  }

  private decodeFat(fat:Uint8Array, header:any) {
    if (this.header.version >= 0x301) {
      var key = this.header.offFat & 0xff;
      for (var i = 0; i < fat.length; i+=2) {
        fat[i    ] ^= key;
        fat[i + 1] ^= key;
        key = (key+1) % 256;
      }
    }
  }

  private convertFname(name:string):string {
    return name.substr(3) + '.' + name.substr(0, 3);
  }

  public get(fname:string):Uint8Array {
    var record = this.fat[this.namesTable[fname]];
    this.data.setOffset(record.offset);
    var arr = data.atomic_array(data.ubyte, record.size).read(this.data);
    if (record.flags & 0x10)
      for (var i = 0; i < 256; i++)
        arr[i] ^= (i >> 1);
    return arr;
  }
}

export function create(buf:ArrayBuffer):RffFile {
  return new RffFile(buf);
}