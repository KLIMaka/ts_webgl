import data = require('../../../libs/dataviewstream');

export class Tile {
  public tileIndex:number;   // tile (ocean, grass, snow, swamp, lava, desert, dirt, wasteland, beach)
  public objectName1:number; // level 1.0
  public indexName1:number;  // index level 1.0 or 0xFF
  public quantity1:number;   // count
  public quantity2:number;   // count
  public objectName2:number; // level 2.0
  public indexName2:number;  // index level 2.0 or 0xFF
  public shape:number;   // shape reflect % 4, 0 none, 1 vertical, 2 horizontal, 3 any
  public generalObject:number; // zero or object
  public indexAddon:number;  // zero or index addons_t
  public uniqNumber1:number; // level 1.0
  public uniqNumber2:number; // level 2.0
}

var tileStruct = data.struct(Tile, [
  ['tileIndex', data.ushort],
  ['objectName1', data.ubyte],
  ['indexName1', data.ubyte],
  ['quantity1', data.ubyte],
  ['quantity2', data.ubyte],
  ['objectName2', data.ubyte],
  ['indexName2', data.ubyte],
  ['shape', data.ubyte],
  ['generalObject', data.ubyte],
  ['indexAddon', data.ushort],
  ['uniqNumber1', data.uint],
  ['uniqNumber2', data.uint]
]);

export class Addon {
  public indexAddon:number;  // zero or next addons_t
  public objectNameN1:number;  // level 1.N
  public indexNameN1:number; // level 1.N or 0xFF
  public quantityN:number; //
  public objectNameN2:number;  // level 2.N
  public indexNameN2:number; // level 1.N or 0xFF
  public uniqNumberN1:number;  // level 1.N
  public uniqNumberN2:number;  // level 2.N 
}

var addonStruct = data.struct(Addon, [
  ['indexAddon', data.ushort],  // zero or next addons_t
  ['objectNameN1', data.ubyte],  // level 1.N
  ['indexNameN1', data.ubyte], // level 1.N or 0xFF
  ['quantityN', data.ubyte], //
  ['objectNameN2', data.ubyte],  // level 2.N
  ['indexNameN2', data.ubyte], // level 1.N or 0xFF
  ['uniqNumberN1', data.uint],  // level 1.N
  ['uniqNumberN2', data.uint]  // level 2.N 
]);

export class Mp2File {

  public data:data.DataViewStream;
  public width:number;
  public height:number;
  public tiles:Tile[];
  public addons:Addon[];

  constructor(buf:ArrayBuffer) {
    this.data = new data.DataViewStream(buf, true);
    var s = this.data;

    var sign = s.readUInt();
    if (sign != 0x0000005C)
      throw new Error('Wrong MP2 file');

    s.setOffset(420);
    this.width = s.readUInt();
    this.height = s.readUInt();
    this.tiles = data.structArray(this.width*this.height, tileStruct)(s);
    var addoncount = s.readUInt();
    this.addons = data.structArray(addoncount, addonStruct)(s);
  }
}

export function create(buf:ArrayBuffer):Mp2File {
  return new Mp2File(buf);
}
