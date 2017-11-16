
import D = require('../../../libs/dataviewstream');
import B = require('../../bitreader');

class RotatingXorStream {

  private enc:number;
  private endChecksum:number;
  private checksum:number;

  constructor(private stream:D.DataViewStream) {
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

class VerticalXorStream {

  private width:number;
  private lastLine:number[];
  private x:number = 0;
  private y:number = 0;

  constructor(private stream:HuffmanStream, width:number) {
    this.width = width / 2;
    this.lastLine = new Array<number>(width);
  }

  public read():number {
    var b = this.stream.read();

    if (this.y > 0) {
      b = b ^ this.lastLine[this.x];
    }
    this.lastLine[this.x] = b;
    if (this.x < this.width - 1) {
        this.x++;
    } else {
        this.y++;
        this.x = 0;
    }
    return b;
  }
}

class HuffmanNode {
  public left:HuffmanNode;
  public right:HuffmanNode;
  public data:number = -1;
}

export class HuffmanStream {

  private tree:HuffmanNode;
  private bitstream:B.BitReader;

  constructor(r:D.DataViewStream) {
    this.bitstream = new B.BitReader(r);
    this.tree = this.loadNode(this.bitstream);
  }

  private loadNode(r:B.BitReader):HuffmanNode {
    if (r.readBit() == 0) {
      var left = this.loadNode(r);
      r.readBit();
      var right = this.loadNode(r);
      var node = new HuffmanNode();
      node.left = left;
      node.right = right;
      return node;
    } else {
      var node = new HuffmanNode();
      node.data = r.readBits(8);
      return node;
    }
  }

  public read():number {
    var node = this.tree;
    while (node.data == -1) {
      if(!this.bitstream.readBit())
        node = node.left;
      else
        node = node.right;
    }
    return node.data;
  }

  public readWord():number {
    return this.read() | (this.read() << 8);
  }

  public readData(len:number):Array<number> {
    var data = new Array<number>(len);
    for (var i = 0; i < len; i++) {
      data[i] = this.read();
    }
    return data;
  }
}

var fa0 = [
  {'m' : 1},
  {'s' : 2},
  {'q' : 3},
  {'0' : 4},
];
var fa1 = [
  {'m' : 1},
  {'s' : 2},
  {'q' : 3},
  {'1' : 4},
];

function search(r:D.DataViewStream, disk:string):number {
  var fa = disk == '0' ? fa0 : fa1;
  var state = 0;
  var length = 0;
  while(!r.eoi() && state != 4) {
    var b = r.readByteString(1);
    var state = fa[state][b] | 0;
    length++;
  }
  return length;
}


function readMsqBlocks(r:D.DataViewStream):number[][] {
  var sign = r.readByteString(4);
  if (sign != 'msq0' && sign != 'msq1')
    throw new Error('No msq header found in file');
  var disk = sign[3];
  var blocks = new Array<number[]>();
  var start = 0;
  var end = 4;

  while(true) {
    end += search(r, disk)
    if (!r.eoi()) {
      blocks.push([start, end-4-start]);
      start = end - 4;
    } else {
      break;
    }
  }
  blocks.push([start, end-start]);
  return blocks;
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
  if (sign != 'msq0' && sign != 'msq1')
    throw new Error('No msq header found in file');
  var xorStream = new RotatingXorStream(r);
  var bytes = new Array<number>(9);
  for (var i = 0; i < 9; i++)
    bytes[i] = xorStream.read();

  if (size == 4614 && isSaveGame(bytes)) {
    return TYPE_SAVEGAME;
  } else if (size == 766 && isShopItems(bytes)) {
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
      this.actions[i] = r.readUByte();
  }

  public get(x:number, y:number):number {
    return this.actions[y*this.mapSize + y];
  }
}

class CentralDirectory {

  public stringsOffset:number;
  public monsterNamesOffset:number;
  public monsterDataOffset:number;
  public actionClassMasterTable:number[] = new Array<number>(16);
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

  public map:number[];
  private unknown:number;

  constructor(r:D.DataViewStream) {
    var mapSize = Math.sqrt(r.readUInt());
    if (mapSize != 32 && mapSize != 64)
      throw new Error('Invalid Tile Map header');

    this.unknown = r.readUInt();
    var huffmanStream = new HuffmanStream(r);
    this.map = new Array<number>(mapSize*mapSize);
    for (var i = 0; i < this.map.length; i++)
      this.map[i] = huffmanStream.read();
  }
}

export class Strings {

  public strings:string[] = [];

  constructor(r:D.DataViewStream, end:number) {
    var start = r.mark();
    var charTable = new Array<number>(60);
    for (var i = 60; i > 0; i--)
      charTable[60-i] = r.readUByte();
    var tmp = r.readUShort();
    var quantity = tmp / 2;
    var stringOffsets = new Array<number>();
    stringOffsets.push(tmp);
    for (var i = 1; i < quantity; i++) {
      tmp = r.readUShort();
      if ((tmp + start + 60 >= end) || (tmp < stringOffsets[i - 1])) {
        if (i == quantity - 1) {
          continue;
        } else {
          throw new Error("Error parsing strings");
        }
      }
      stringOffsets.push(tmp);
    }
    for (var i = 0; i < stringOffsets.length; i++) {
      r.setOffset(stringOffsets[i] + 60 + start);
      this.readStringGroup(r, charTable, end);
    }
  }

  private readStringGroup(r:D.DataViewStream, charTable:number[], end:number):void {
    var bitStream = new B.BitReader(r);
    for (var j = 0; j < 4; j++) {
      var upper = false;
      var high = false;
      var str = '';
      outer: while (true) {
        if (r.mark() > end)
          return;
        var index = bitStream.readBits(5, true);
        switch (index) {
          case 0x1f: 
            high = true;
            break;
          case 0x1e:
            upper = true;
            break;
          default:
            var char_ = charTable[index + (high ? 0x1e : 0)];
            if (char_ == 0) break outer;
            var s = String.fromCharCode(char_);
            if (upper)
              s = s.toUpperCase();
            str += s;
            upper = false;
            high = false;
        }
      }
      this.strings.push(str);
    }
  }
}

export class Skills {

  public skills:number[][] = new Array<number[]>();

  constructor(r:D.DataViewStream) {
    for (var i = 0; i < 30; i++) {
      this.skills.push([r.readUByte(), r.readUByte()]);
    }
  }
}

export class Items {

  private items:number[][] = new Array<number[]>();

  constructor(r:D.DataViewStream) {
    for (var i = 0; i < 30; i++) {
      var id = r.readUByte();
      var load = r.readUByte();
      if (id != 0)
        this.items.push([id, load]);
    }
  }
}

export class Char {

  public name:string;
  public str:number;
  public iq:number;
  public lck:number;
  public spd:number;
  public agi:number;
  public dex:number;
  public chr:number;
  public money:number;
  public gender:number;
  public natio:number;
  public ac:number;
  public maxCon:number;
  public con:number;
  public weapon:number;
  public skillPoints:number;
  public exp:number;
  public level:number;
  public armor:number;
  public lastCon:number;
  public afflictions:number;
  public isNpc:number;
  public unknown2A:number;
  public itemRefuse:number;
  public skillRefuse:number;
  public attribRefuse:number;
  public tradeRefuse:number;
  public unknown2F:number;
  public joinString:number;
  public willingness:number;
  public rank:string;
  public skills:Skills;
  public items:Items;

  constructor(r:D.DataViewStream) {
    this.name = r.readByteString(14);
    this.str = r.readUByte();
    this.iq = r.readUByte();
    this.lck = r.readUByte();
    this.spd = r.readUByte();
    this.agi = r.readUByte();
    this.dex = r.readUByte();
    this.chr = r.readUByte();
    var tmp = r.readUInt();
    this.money = tmp & 0xffffff;
    this.gender = (tmp >> 16) & 0xff;
    this.natio = r.readUByte();
    this.ac = r.readUByte();
    this.maxCon = r.readUShort();
    this.con = r.readUShort();
    this.weapon = r.readUByte();
    this.skillPoints = r.readUByte();
    tmp = r.readUInt();
    this.exp = tmp & 0xffffff;
    this.level = (tmp >> 16) & 0xff;
    this.armor = r.readUByte();
    this.lastCon = r.readUShort();
    this.afflictions = r.readUByte();
    this.isNpc = r.readUByte();
    this.unknown2A = r.readUByte();
    this.itemRefuse = r.readUByte();
    this.skillRefuse = r.readUByte();
    this.attribRefuse = r.readUByte();
    this.tradeRefuse = r.readUByte();
    this.unknown2F = r.readUByte();
    this.joinString = r.readUByte();
    this.willingness = r.readUByte();
    this.rank = r.readByteString(25);
    r.skip(53);
    this.skills = new Skills(r);
    r.skip(1);
    this.items = new Items(r);
    r.skip(7);
  }
}

export class NPCS {

  public chars:Char[] = [];

  constructor(r:D.DataViewStream) {
    var offset = r.mark();
    if (r.readUShort() != 0)
      return;

    offset += 2;
    var quantity = (r.readUShort() - offset) / 2;
    if (quantity < 1 || quantity > 255)
      return;

    offset += quantity * 2;
    for (var i = 1; i < quantity; i++) {
      var tmp = r.readUShort();
      if (tmp != (offset + i * 0x100))
        return
    }

    for (var i = 0; i < quantity; i++)
      this.chars.push(new Char(r));
  }
}

export class Monster {

  public name:string;
  public exp:number;
  public skill:number;
  public randomDamage:number;
  public maxGroupSize:number;
  public ac:number;
  public fixedDamage:number;
  public weaponType:number;
  public type:number;
  public picture:number;

  constructor(r:D.DataViewStream, name:string) {
    this.name = name;
    this.exp = r.readUShort();
    this.skill = r.readUByte();
    this.randomDamage = r.readUByte();
    var tmp = r.readUByte();
    this.maxGroupSize = tmp >> 4;
    this.ac = tmp & 15;
    var tmp = r.readUByte();
    this.fixedDamage = tmp >> 4;
    this.weaponType = tmp & 15;
    this.type = r.readUByte();
    this.picture = r.readUByte();
  }
}

export class Monsters {

  public monsters:Monster[] = [];

  constructor(r:D.DataViewStream, quantity:number, dataOffset:number) {
    var names:string[] = [];
    for (var i = 0; i < quantity; i++) {
      var name = '';
      var b = r.readUByte();
      while (b != 0) {
        name += String.fromCharCode(b);
        b = r.readUByte();
      } 
      names.push(name);
    }

    r.setOffset(dataOffset);
    for (var i = 0; i < quantity; i++) {
      this.monsters.push(new Monster(r, names[i]));
    }
  }
}

export class GameMap {

  public mapSize:number;
  private size:number;
  private tilemapOffset:number;

  public actionClassMap:ActionClassMap;
  public actionMap:ActionMap;
  public info:Info;
  public battleSettings:BattleSettings;
  public tileMap:TileMap;
  public strings:Strings;
  public npcs:NPCS;
  public monsters:Monsters;


  constructor(r:D.DataViewStream, size:number) {
    var sign = r.readByteString(4);
    if (sign != 'msq0' && sign != 'msq1')
      throw new Error('No msq header found in file');

    var start = r.mark();
    var xorStream = new RotatingXorStream(r);
    var bytes = new Uint8Array(6189);
    for (var i = 0; i < 6189; i++) {
      bytes[i] = xorStream.read();
    }

    var mapSize = this.getMapSize(bytes);
    var encSize = this.getEncryptionSize(bytes, mapSize);

    bytes = new Uint8Array(size - 6);
    r.setOffset(start);
    xorStream = new RotatingXorStream(r);
    for (var i = 0; i < encSize; i++)
      bytes[i] = xorStream.read();
    for (var i = encSize; i < bytes.length; i++)
      bytes[i] = r.readUByte();

    var tilemapOffset = this.getTilemapOffset(bytes, mapSize);
    var stream = new D.DataViewStream(bytes.buffer, true);
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

    stream.setOffset(centralDirectory.npcOffset);
    this.npcs = new NPCS(stream);

    var monstersOffset = centralDirectory.monsterDataOffset;
    if (monstersOffset != 0) {
      var quantity = (centralDirectory.stringsOffset - monstersOffset) / 8;
      stream.setOffset(centralDirectory.monsterNamesOffset);
      this.monsters = new Monsters(stream, quantity, monstersOffset);
    }
  }

  private getMapSize(bytes:Uint8Array):number {
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

    if (is32 == is64)
      throw new Error('Cannot determine map size');

    return is64 ? 64 : 32;
  }

  private getEncryptionSize(bytes:Uint8Array, mapSize:number):number {
    var offset = mapSize * mapSize * 3 / 2;
    return ((bytes[offset] & 0xff) | ((bytes[offset + 1] & 0xff) << 8));
  }

  private getTilemapOffset(bytes:Uint8Array, mapSize:number):number {
    var i = bytes.length - 9;
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

  public maps:GameMap[] = [];

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

export class Pic {

  public pixels:Uint8Array;

  constructor(hs:HuffmanStream, w:number, h:number) {
    var vxor = new VerticalXorStream(hs, w);
    this.pixels =new Uint8Array(w*h);
    for (var i = 0; i < w*h; i+=2){
      var b = vxor.read();
      this.pixels[i] = b >> 4;
      this.pixels[i+1] = b & 0xf;
    }
  }
}

var MSG_UNCOMPRESSED = 'MSG_UNCOMPRESSED';
var MSG_COMPRESSED = 'MSG_COMPRESSED';
var MSG_CPA_ANIMATION = 'MSG_CPA_ANIMATION';
 
class MsqHeader {
  constructor(
    public type:String,
    public disk:number,
    public size:number) {}
}

function readMsgHeader(r:D.DataViewStream):MsqHeader {
  var sign = D.atomic_array(D.ubyte, 4).read(r);
  if (r.eoi())
    return null;
  if (sign[0] == 0x6d && sign[1] == 0x73 && sign[2] == 0x71 && (sign[3] == 30 || sign[3] == 31)) {
    return new MsqHeader(MSG_UNCOMPRESSED, sign[3]-30, 0);
  }

  var size = sign[0] | (sign[1] << 8) | (sign[2] << 16) | (sign[3] << 24);
  sign = D.atomic_array(D.ubyte, 4).read(r);
  if (r.eoi())
    return null;
  if (sign[0] == 0x6d && sign[1] == 0x73 && sign[2] == 0x71 && (sign[3] == 0 || sign[3] == 1)) {
    return new MsqHeader(MSG_COMPRESSED, sign[3], size);
  }

  if (sign[0] == 0x08 && sign[1] == 0x67 && sign[2] == 0x01 && sign[3] == 0x00) {
    return new MsqHeader(MSG_CPA_ANIMATION, sign[3], size);
  }

  throw new Error('Unable to read MSQ header from stream');
}

function readPicsAnimation(r:D.DataViewStream, width:number) {
  var header = readMsgHeader(r);
  if (header == null)
    return null;
  if (header.type != MSG_COMPRESSED)
    throw new Error('Expected base frame block of PICS stream to be compressed');

  var height = header.size *2 / width;
  var huffmanStream = new HuffmanStream(r);
  var baseFrame = new Pic(huffmanStream, width, height);

  header = readMsgHeader(r);
  if (header == null)
    throw new Error('Unexpected end of stream while reading PICS animation block');
  if (header.type != MSG_COMPRESSED)
    throw new Error('Expected animation block of PICS stream to be compressed');

  huffmanStream = new HuffmanStream(r);

  var headerSize = huffmanStream.readWord();
  var instructions = huffmanStream.readData(headerSize);
  var dataSize = huffmanStream.readWord();
  
  var address = huffmanStream.readWord();
  if (address == 0xffff)
    return null;
  var bytes = ((address >> 12) & 0xf) + 1;
  address = address & 0xfff;
  var size = 2;
  var offset = address;
  var diff = huffmanStream.readData(bytes);


}

export class HTDSTileset {

  public pics:Pic[] = [];

  constructor(r:D.DataViewStream) {
    var size = r.readUInt();
    var sign = r.readByteString(3) + r.readUByte();
    if (sign != 'msq0' && sign != 'msq1')
      throw new Error('No msq header found in file');

    var quantity = size * 2 / 16 / 16;
    var huffmanStream = new HuffmanStream(r);
    for ( var i = 0; i < quantity; i++) {
      this.pics.push(new Pic(huffmanStream, 16, 16));
    }
  }
}

export class HTDS {

  public tilesets:HTDSTileset[] = [];

  constructor(file:ArrayBuffer) {
    var r = new D.DataViewStream(file, true);
    while (!r.eoi())
      this.tilesets.push(new HTDSTileset(r));
  }

}