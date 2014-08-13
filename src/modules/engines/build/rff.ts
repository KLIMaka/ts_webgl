import data = require('../../../libs/dataviewstream');

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
  private fat;
  private namesTable = {};

  constructor(buf:ArrayBuffer) {
    this.data = new data.DataViewStream(buf, true);
    this.header = headerStruct(this.data);
    this.data.setOffset(this.header.offFat);
    var len = this.header.numFiles * 48;
    var fat = data.array(data.ubyte, len)(this.data);
    if (this.header.version >= 0x301) {
      var key = this.header.offFat & 0xff;
      for (var i = 0; i < len; i+=2) {
        fat[i    ] ^= key;
        fat[i + 1] ^= key;
        key = (key+1) % 256;
      }
    }
    var fatBuffer = new data.DataViewStream(fat.buffer, true);
    fatBuffer.setOffset(fat.byteOffset);
    this.loadFat(fatBuffer, this.header.numFiles);
  }

  private loadFat(stream:data.DataViewStream, numFiles:number):void {
    this.fat = data.structArray(numFiles, fatRecord)(stream);
    for (var i in this.fat) {
      var r = this.fat[i];
      this.namesTable[r.filename] = i;
    }
  }

  private convertFname(name:string):string {
    return name;
  }

  public get(fname:string):data.DataViewStream {
    var record = this.fat[this.namesTable[this.convertFname(fname)]];
    return null;
  }
}

export function create(buf:ArrayBuffer):RffFile {
  return new RffFile(buf);
}