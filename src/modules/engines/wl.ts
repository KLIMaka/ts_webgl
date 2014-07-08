
import D = require('../../libs/dataviewstream');
import B = require('../bitreader');

class RotatingXorStream {

  private enc:number;
  private endChecksum:number;
  private checksum:number;

  constructor(private stream:D.DataViewStream) {
    this.init();
  }

  private init():void {
    var e1 = this.stream.readUByte();
    var e2 = this.stream.readUByte();
    this.enc = e1 ^ e2;
    this.endChecksum = e1 | (e2 << 8);
    this.checksum = 0;
  }

  public read():number {
    var crypted = this.stream.readUByte();
    var b = crypted ^ this.enc;
    this.checksum = (this.checksum - b) & 0xffff;
    this.enc = (this.enc + 0x1f) % 0x100;
    return b;
  }
}

class HuffmanNode {
  public left:HuffmanNode;
  public right:HuffmanNode;
  public data:number = -1;
}

class HuffmanStream {

  private tree:HuffmanNode;
  private bitstream:B.BitReader;

  constructor(r:D.DataViewStream) {
    this.bitstream = new B.BitReader(r);
    this.tree = this.loadNode(this.bitstream);
  }

  private loadNode(r:B.BitReader):HuffmanNode {
    if (r.read(1) == 0) {
      var left = this.loadNode(r);
      r.read(1);
      var right = this.loadNode(r);
      var node = new HuffmanNode();
      node.left = left;
      node.right = right;
      return node;
    } else {
      var node = new HuffmanNode();
      node.data = r.read(8);
      return node;
    }
  }

  public read():number {
    var node = this.tree;
    while (node.data == -1) {
      if(this.bitstream.read(1))
        node = node.left;
      else
        node = node.right;
    }
    return node.data;
  }
}

function readMsqBlocks(r:D.DataViewStream):number[][] {
  var sign = r.readByteString(4);
  if (sign != 'msq0' || sign != 'msq1')
    throw new Error('No msq header found in file');
  var disk = sign[3];
  var stage = 0;
  var blocks = new Array<number[]>();
  var start = 0;
  var end = 4;

  while(!r.eoi()) {
    var b = r.readUByte();
    switch (stage) {
        case 0: 
          if (b == 'm')
            stage++;
          break;
        case 1: 
          if (b == 's')
            stage++;
          else
            stage = 0;
          break;
        case 2: 
          if (b == 'q')
            stage++;
          else
            stage = 0
          break;
        case 3: 
          if (b == disk){
            blocks.push([start, end-3-start]);
            start = end - 3;
          }
          stage = 0;
          break;
      }
      end++;
    }
  blocks.push([start, end-start]);
  }
}

var TYPE_SAVEGAME = 'TYPE_SAVEGAME';
var TYPE_SHOPLIST = 'TYPE_SHOPLIST';
var TYPE_MAP = 'TYPE_MAP';

function isSaveGame(bytes:number[]):boolean {
  var seen = {};
  for (var i = 0; i < 8; i++) {
    var b = bytes[i];
    if (b > 7) return false;
    if (b != 0 && seen[b] == 1) return false;
    seen[b] = 1;
  }
  return true;
}

function isShopItems(bytes:number[]):boolean {
  if (bytes[0] == 0x60 && bytes[1] == 0x60 && bytes[2] == 0x60) 
    return true;
  return false;
}

function getType(r:D.DataViewStream, size:number) {
  var sign = r.readByteString(4);
  if (sign != 'msq0' || sign != 'msq1')
    throw new Error('No msq header found in file');
  var xorStream = new RotatingXorStream(r);
  var bytes = new Array<number>(9);
  for (var i = 0; i < 9; i++)
    bytes[i] = xorStream.read();

  if (msqBlockSize == 4614 && isSaveGame(bytes)) {
    return TYPE_SAVEGAME;
  } else if (msqBlockSize == 766 && isShopItems(bytes)) {
    return TYPE_SHOPLIST;
  } else {
    return TYPE_MAP;
  }

}

export class ActionClassMap {

  private actionClasses:number[];
  private mapSize:number; 

  constructor(r:D.DataViewStream, mapSize:number) {
    this.mapSize = mapSize;
    this.actionClasses = new Array<number>(mapSize*mapSize);
    for (var i = 0; i < mapSize*mapSize; i+=2) {
      var b = r.readUByte();
      this.actionClasses[i] = (b >> 4) & 0x0f;
      this.actionClasses[i+1] = b & 0x0f;
    }
  }

  public get(x:number, y:number):number {
    return this.actionClasses[y*this.mapSize + y];
  }
}

export class ActionMap {

  private actions:number[];
  private mapSize:number; 

  constructor(r:D.DataViewStream, mapSize:number) {
    this.mapSize = mapSize;
    this.actions = new Array<number>(mapSize*mapSize);
    for (var i = 0; i < mapSize*mapSize; i++)
      this.actions[i] r.readUByte();
  }

  public get(x:number, y:number):number {
    return this.actions[y*this.mapSize + y];
  }
}

class CentralDirectory {

  public stringsOffset:number;
  public monsterNamesOffset:number;
  public monsterDataOffset:number;
  public actionClassMasterTable:number[] = new Array<number(16);
  public nibble6Offset:number;
  public npcOffset:number;

  constructor(r:D.DataViewStream) {
    this.stringsOffset = r.readUShort();
    this.monsterNamesOffset = r.readUShort();
    this.monsterDataOffset = r.readUShort();
    for (var i = 0; i < 16; i++)
      this.actionClassMasterTable[i] = r.readUShort();
    this.nibble6Offset = r.readUShort();
    this.npcOffset = r.readUShort();
    if (r.readUShort() != 0) {
      throw new Error('Last offset must be 0');
    }
  }
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

  constructor(r:D.DataViewStream) {
    this.unknown0 = r.readUByte();
    this.unknown1 = r.readUByte();
    this.encounterFrequency = r.readUByte();
    this.tileset = r.readUByte();
    this.lastMonster = r.readUByte();
    this.maxEncounters = r.readUByte();
    this.backgroundTile = r.readUByte();
    this.timeFactor = r.readUShort();
    this.unknown9 = r.readUByte();
  }
}

export class BattleSettings {

  public strings:number[] = new Array<number>(37);

  constructor(r:D.DataViewStream) {
    for (var i = 0; i < 37; i++)
      this.strings[i] = r.readUByte();
  }
}

export class TileMap {

  private mapSize:number;
  private map:number[];

  constructor(r:D.DataViewStream) {
    this.mapSize = Math.sqrt(r.readUInt());
    if (this.mapSize != 32 && this.mapSize != 64)
      throw new Error('Invalid Tile Map header');

    this.unknown = r.readUInt();
    var huffmanStream = new HuffmanStream(r);
    this.map = new Array<number>(this.mapSize*this.mapSize);
    for (var i = 0; i < map.length; i++)
      this.map[i] = huffmanStream.read();
  }
}

export class Strings {

  constructor(r:D.DataViewStream, end:number) {
    var start = r.mark();
    var charTable = new Array<number[]>(60);
    for (var i = 60; i > 0; i--)
      charTable[60-i] = [r.readUByte(), i];
    var tmp = r.readUShort();
    var quantity = tmp / 2;
    var stringOffsets = new Array<number>();
    stringsOffset.push(tmp);
    for (var i = 1; i < quantity; i++) {
      tmp = r.readUShort();
      if ((tmp + start + 60 >= end) || (tmp < stringOffsets.get(i - 1))) {
        if (i == quantity - 1) {
          continue;
        } else {
          throw new Error("Error parsing strings");
        }
      }
      stringOffsets.push(tmp);
    }
    for (var i = 0; i < stringOffsets.length; i++) {
      r.setOffset(stringOffsets.get(i) + 60 + start);
      this.readStringGroup(r, charTable, end);
    }
  }

  private readStringGroup(r:D.DataViewStream, charTable:number[], end:number) {

  }
}

export class GameMap {

  private mapSize:number;
  private size:number;
  private tilemapOffset:number;

  constructor(r:D.DataViewStream, size:number) {
    var sign = r.readByteString(4);
    if (sign != 'msq0' || sign != 'msq1')
      throw new Error('No msq header found in file');

    var start = r.mark();
    var xorStream = new RotatingXorStream(r);
    var bytes = new Array<number>(6189);
    for (var i = 0; i < 6189; i++) {
      bytes[i] = xorStream.read();
    }

    var mapSize = this.getMapSize(bytes);
    var encSize = this.getEncryptionSize(bytes, mapSize);

    bytes = new Array<number>(size - 6);
    r.setOffset(start);
    xorStream = new RotatingXorStream(r);
    for (var i = 0; i < encSize; i++)
      bytes[i] = xorStream.read();
    for (var i = encSize; i < bytes.length; i++)
      bytes[i] = r.readUByte();

    var tilemapOffset = getTilemapOffset(bytes, mapSize);
    var stream = new D.DataViewStream(new UInt8Array(bytes), true);
    this.mapSize = mapSize;
    this.size = size;
    this.tilemapOffset = tilemapOffset;
    this.read(stream);
  }

  private read(stream:D.DataViewStream):void {
    this.actionClassMap = new ActionClassMap(stream, this.mapSize);
    this.actionMap = new ActionMap(stream, this.mapSize);
    var centralDirectory = new CentralDirectory(stream);
    stream.readUByte();
    this.info = new Info(stream);
    this.battleSettings = new BattleSettings(stream);

    stream.setOffset(this.tilemapOffset);
    this.tileMap = new TileMap(stream);

    stream.setOffset(centralDirectory.stringsOffset);
    this.strings = new Strings(stream, this.tilemapOffset);
  }

  private getMapSize(bytes:number[]):number {
    var is64 = false;
    var offset = 64 * 64 * 3 / 2;
    if ((offset + 44 < bytes.length) && (bytes[offset + 44] == 64 && bytes[offset + 6] == 0 && bytes[offset + 7] == 0)) {
      is64 = true;
    }

    var is32 = false;
    offset = 32 * 32 * 3 / 2;
    if ((offset + 44 < bytes.length && bytes[offset + 6] == 0 && bytes[offset + 7] == 0) && (bytes[offset + 44] == 32)) {
      is32 = true;
    }

    if (i32 == is64)
      throw new Error('Cannot determine map size');

    return is64 ? 64 : 32;
  }

  private getEncryptionSize(bytes:number[], mapSize:number):number {
    var offset = mapSize * mapSize * 3 / 2;
    return ((bytes[offset] & 0xff) | ((bytes[offset + 1] & 0xff) << 8));
  }

  private getTilemapOffset(bytes:number[], mapsize:number):number {
    int i = bytes.length - 9;
    while (i > 0) {
      if ((bytes[i] == 0) && (bytes[i + 1] == ((mapSize * mapSize) >> 8))
          && (bytes[i + 2] == 0) && (bytes[i + 3] == 0)
          && (bytes[i + 6] == 0) && (bytes[i + 7] == 0)) {
        return i;
      }
      i--;
    }
    throw new Error('Unable to find tiles offset');
  }
}

export class Game {

  private maps:GameMap[] = [];

  constructor(file:ArrayBuffer) {
    var r = new D.DataViewStream(file, true);
    var blocks = readMsqBlocks(r);
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      r.setOffset(block[0]);
      var type = getType(r, block[1]);
      r.setOffset(block[0]);

      switch (type) {
        case TYPE_SAVEGAME:
          break;
        case TYPE_SHOPLIST:
          break;
        case TYPE_MAP:
          this.maps.push(new GameMap(r, block[1]));
          break;
      }
    }
  }
}