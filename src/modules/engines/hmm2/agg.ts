import data = require('../../../libs/dataviewstream');

export class FileRecord {
  public hash:number;
  public offset:number;
  public size:number;
}

var fat = data.struct(FileRecord, [
  ['hash', data.uint],
  ['offset', data.uint],
  ['size', data.uint]
]);

export class AggFile {
  private data:data.DataViewStream;
  private num_files:number;
  private fat:FileRecord[];
  private nametable:{[index:string]:number} = {};

  constructor(buf:ArrayBuffer) {
    this.data = new data.DataViewStream(buf, true);
    this.num_files = data.ushort.read(this.data);
    this.fat = data.array(fat, this.num_files).read(this.data);

    var offset = this.data.mark();
    for (var i = 0; i < this.num_files; i++) {
      offset += this.fat[i].size;
    }

    var nametable = this.nametable;
    this.data.setOffset(offset);
    for (var i = 0; i < this.num_files; i++) {
      nametable[data.string(15).read(this.data)] = i;
    }
  }

  public get(name:string):data.DataViewStream {
    var rec:any = this.nametable[name];
    if (rec == undefined)
      return null;
    this.data.setOffset(this.fat[rec].offset);
    return this.data.subView();
  }

  public getList():string[] {
    return Object.keys(this.nametable);
  }
}

export function create(buf:ArrayBuffer):AggFile {
  return new AggFile(buf);
}

export function createPalette(data:data.DataViewStream):Uint8Array {
  var pal = new Uint8Array(768);
  for (var i = 0; i < 768; i++)
    pal[i] = data.readUByte() << 2;
  return pal;
}

export function hash(str:string):number {
  var a = 0;
  var b = 0;
  for (var i = str.length-1; i >=0; i--) {
    var c = str[i].toUpperCase().charCodeAt(0);
    a = (a<<5)+(a>>25);
    b+=c;
    a+=b+c;
  }

  return a;
}