import * as data  from '../../../libs/dataviewstream';

export class ArtInfo {
  constructor(public w:number, public h:number, public anum:number, public img:Uint8Array) {}
}

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
    var hs = data.array(data.ushort, size).read(stream);
    var ws = data.array(data.ushort, size).read(stream);
    var anums = data.array(data.uint, size).read(stream);
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

  public getInfo(id:number):ArtInfo {
    var offset = this.offsets[id];
    this.stream.setOffset(offset);
    var w = this.ws[id];
    var h = this.hs[id];
    var anum = this.anums[id];
    var pixels = data.atomic_array(data.ubyte, w*h).read(this.stream);
    return new ArtInfo(w, h, anum, pixels);
  }

  public getStart():number {
    return this.start;
  }

  public getEnd():number {
    return this.end;
  }
}

export interface ArtInfoProvider {
  getInfo(picnum:number):ArtInfo;
}

export class ArtFiles implements ArtInfoProvider {

  constructor(private arts:ArtFile[]) {}

  private getArt(id:number) {
    for (var i in this.arts){
      var art = this.arts[i];
      if (id >= art.getStart() && id <= art.getEnd())
        return art;
    }
    return null;
  }

  public getInfo(id:number):ArtInfo {
    var art = this.getArt(id);
    if (art == null) return null;
    return art.getInfo(id - art.getStart());
  }
}



export function create(stream:data.DataViewStream):ArtFile {
  return new ArtFile(stream);
}

export function createArts(arts:ArtFile[]):ArtFiles {
  return new ArtFiles(arts);
}