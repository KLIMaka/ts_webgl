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
    var hs = new Array<number>(size);
    for (var i = 0; i < size; i++)
      hs[i] = stream.readUShort();
    var ws = new Array<number>(size);
    for (var i = 0; i < size; i++)
      ws[i] = stream.readUShort();
    var anums = new Array<number>(size);
    for (var i = 0; i < size; i++)
      anums[i] = stream.readUInt();
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
    return data.arrayCreator(Uint8Array, this.ws[id]*this.hs[id])(this.stream);
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