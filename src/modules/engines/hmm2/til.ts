import data = require('../../../libs/dataviewstream');

export class TilFile {
  private count:number;
  public width:number;
  public height:number;
  private goff:number;

  constructor(private data:data.DataViewStream) {
    this.count = data.readUShort();
    this.width = data.readUShort();
    this.height = data.readUShort();
    this.goff = data.mark();
  }

  public getTile(id:number):Uint8Array {
    this.data.setOffset(this.goff+id*this.width*this.height);
    return data.array(data.ubyte, this.width*this.height).read(this.data);
  }
}

export function create(data:data.DataViewStream):TilFile {
  return new TilFile(data);
}