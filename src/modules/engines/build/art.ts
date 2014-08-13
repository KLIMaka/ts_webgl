import data = require('../../../libs/dataviewstream');

export class ArtFile {

  public offsets:number[];
  public ws:number[];
  public hs:number[];
  public anums:number[];
  public start:number;
  public end:number;
  public size:number;


  constructor(private stream:data.DataViewStream) {
    var version = stream.readUInt();
    var numtiles = stream.readUInt();
    var start = stream.readUInt();
    var end = stream.readUInt();
    var size = end - start + 1;
    var hs = data.array(data.ushort, size)(stream);
    var ws = data.array(data.ushort, size)(stream);
    var anums = data.array(data.uint, size)(stream);
    var offsets = new Array<number>(size);
    var offset = stream.mark();
    for (var i = 0; i < size; i++){
      offsets[i] = offset;
      offset += ws[i] * hs[i];
    }

    this.offsets = offsets;
    this.ws = ws;
    this.hs = hs;
    this.anums = anums;
    this.start = start;
    this.end = end;
    this.size = size;
  }

  public getImage(id:number):Uint8Array {
    var offset = this.offsets[id];
    this.stream.setOffset(offset);
    return data.array(data.ubyte, this.ws[id]*this.hs[id])(this.stream);
  }

  public getWidth(id:number) {
    return this.ws[id];
  }

  public getHeight(id:number) {
    return this.hs[id];
  }
}

export function create(stream:data.DataViewStream):ArtFile {
  return new ArtFile(stream);
}