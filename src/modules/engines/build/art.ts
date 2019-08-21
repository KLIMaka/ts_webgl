import * as data from '../../../libs/dataviewstream';

export class ArtInfo {
  constructor(public w: number, public h: number, public attrs: Attributes, public img: Uint8Array) { }
}

export const NO_ANIMATION = 0;
export const OSCILLATING_ANIMATION = 1;
export const ANIMATE_FORWARD = 2;
export const ANIMATE_BACKWARD = 3;

export class Attributes {
  public frames: number;
  public type: number;
  public xoff: number;
  public yoff: number;
  public speed: number;
}

var anumStruct = data.struct(Attributes, [
  ['frames', data.bits(6)],
  ['type', data.bits(2)],
  ['xoff', data.bits(-8)],
  ['yoff', data.bits(-8)],
  ['speed', data.bits(4)],
  ['_', data.bits(4)]
]);

export class ArtFile {

  public offsets: number[];
  public ws: number[];
  public hs: number[];
  public anums: Attributes[];
  public start: number;
  public end: number;
  public size: number;


  constructor(private stream: data.DataViewStream) {
    var version = stream.readUInt();
    var numtiles = stream.readUInt();
    var start = stream.readUInt();
    var end = stream.readUInt();
    var size = end - start + 1;
    var hs = data.array(data.ushort, size).read(stream);
    var ws = data.array(data.ushort, size).read(stream);
    var anums = data.array(anumStruct, size).read(stream);
    var offsets = new Array<number>(size);
    var offset = stream.mark();
    for (var i = 0; i < size; i++) {
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

  public getInfo(id: number): ArtInfo {
    var offset = this.offsets[id];
    this.stream.setOffset(offset);
    var w = this.ws[id];
    var h = this.hs[id];
    var anum = this.anums[id];
    var pixels = data.atomic_array(data.ubyte, w * h).read(this.stream);
    return new ArtInfo(h, w, anum, pixels);
  }

  public getStart(): number {
    return this.start;
  }

  public getEnd(): number {
    return this.end;
  }
}

export interface ArtInfoProvider {
  getInfo(picnum: number): ArtInfo;
}

export class ArtFiles implements ArtInfoProvider {

  constructor(private arts: ArtFile[]) { }

  private getArt(id: number) {
    for (var i in this.arts) {
      var art = this.arts[i];
      if (id >= art.getStart() && id <= art.getEnd())
        return art;
    }
    return null;
  }

  public getInfo(id: number): ArtInfo {
    var art = this.getArt(id);
    if (art == null) return null;
    return art.getInfo(id - art.getStart());
  }
}



export function create(stream: data.DataViewStream): ArtFile {
  return new ArtFile(stream);
}

export function createArts(arts: ArtFile[]): ArtFiles {
  return new ArtFiles(arts);
}