import D = require('../../../libs/dataviewstream');
import U = require('./utils');

export class CentralDirectory {
  public stringsOffset:number;
  public monsterNamesOffset:number;
  public monsterDataOffset:number;
  public actionClassMasterTable:number[] = new Array<number>(16);
  public nibble6Offset:number;
  public npcOffset:number;
}

var CentralDirectoryStruct = D.struct(CentralDirectory, [
  ['stringsOffset', D.ushort],
  ['monsterNamesOffset', D.ushort],
  ['monsterDataOffset', D.ushort],
  ['actionClassMasterTable', D.array(D.ushort, 16)],
  ['nibble6Offset', D.ushort],
  ['npcOffset', D.ushort]
]);

export function readCentralDirectory(r:D.DataViewStream):CentralDirectory {
  var result = CentralDirectoryStruct.read(r);
  if (r.readUShort() != 0) {
    throw new Error('Last offset must be 0');
  }
  return result;
}

export class Info {
  public unknown0:number;
  public unknown1:number;
  public encounterFrequency:number;
  public tileset:number;
  public lastMonster:number;
  public maxEncounters:number;
  public backgroundTile:number;
  public timeFactor:number;
  public unknown9:number;
}

var InfoStruct = D.struct(Info, [
  ["unknown0", D.ubyte],
  ["unknown1", D.ubyte],
  ["encounterFrequency", D.ubyte],
  ["tileset", D.ubyte],
  ["lastMonster", D.ubyte],
  ["maxEncounters", D.ubyte],
  ["backgroundTile", D.ubyte],
  ["timeFactor", D.ushort],
  ["unknown9", D.ubyte]
]);

export function readInfo(r:D.DataViewStream):Info {
  return InfoStruct.read(r);
}


export class BattleSettings {
  public strings:number[] = new Array<number>(37);

  constructor(r:D.DataViewStream) {
    this.strings = D.array(D.ubyte, 37).read(r);
  }
}

export class TileMap {

  public map:number[];
  private unknown:number;

  constructor(r:D.DataViewStream) {
    var mapSize = Math.sqrt(r.readUInt());
    if (mapSize != 32 && mapSize != 64)
      throw new Error('Invalid Tile Map header');

    this.unknown = r.readUInt();
    var huffmanStream = U.huffmanStream(r);
    this.map = new Array<number>(mapSize*mapSize);
    for (var i = 0; i < this.map.length; i++)
      this.map[i] = huffmanStream.read();
  }
}