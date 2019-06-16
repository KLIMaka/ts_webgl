import * as DATA from '../../../libs/dataviewstream';
import * as LOADER from './loader';
import { Header1, Sector, Wall, Sprite, Board } from './structs';
import { BloodBoard, BloodSector, BloodWall, BloodSprite, SpriteExtra } from './bloodstructs';


function decryptBuffer(buffer:Uint8Array, size:number, key:number) {
  for (var i = 0; i < size; i++)
    buffer[i] = buffer[i] ^ (key + i);
}

function createStream(arr:Uint8Array) {
  return new DATA.DataViewStream(arr.buffer, true);
}

var header1Struct = DATA.struct(Header1, [
   ['startX', DATA.int],
   ['startY', DATA.int],
   ['startZ', DATA.int],
   ['startAng', DATA.short],
   ['startSec', DATA.short],
   ['unk', DATA.short],
]);

var header2Struct = DATA.struct(Object, [
  ['unk', DATA.array(DATA.ubyte, 9)],
]);

var header3Struct = DATA.struct(Object,[
  ['mapRevisions', DATA.int],
  ['numSectors', DATA.short],
  ['numWalls', DATA.short],
  ['numSprites', DATA.short],
]);

var spriteExtraStruct = DATA.struct(SpriteExtra, [
  ['_', DATA.atomic_array(DATA.byte, 15)],
  ['data1', DATA.short],
  ['data2', DATA.short],
  ['data3', DATA.short],
]);

function readSectors(header3:any, stream:DATA.DataViewStream):BloodSector[] {
  var dec = ((header3.mapRevisions * LOADER.sectorStruct.sizeof()) & 0xFF);
  var sectors = [];
  var sectorReader = DATA.atomic_array(DATA.ubyte, LOADER.sectorStruct.sizeof());
  for (var i = 0; i < header3.numSectors; i++) {
    var buf = sectorReader.read(stream);
    decryptBuffer(buf, LOADER.sectorStruct.sizeof(), dec);
    var sector = LOADER.sectorStruct.read(createStream(buf));
    sectors.push(sector);
    if (sector.extra != 0 && sector.extra != 65535)
      stream.skip(60);
  }
  return sectors;
}

function readWalls(header3:any, stream:DATA.DataViewStream):BloodWall[] {
  var dec = (((header3.mapRevisions * LOADER.sectorStruct.sizeof()) | 0x4d) & 0xFF);
  var walls = [];
  var wallReader = DATA.atomic_array(DATA.ubyte, LOADER.wallStruct.sizeof());
  for (var i = 0; i < header3.numWalls; i++) {
    var buf = wallReader.read(stream);
    decryptBuffer(buf, LOADER.wallStruct.sizeof(), dec);
    var wall = LOADER.wallStruct.read(createStream(buf));
    walls.push(wall);
    if (wall.extra != 0 && wall.extra != 65535)
      stream.skip(24);
  }
  return walls;
}

function readSprites(header3:any, stream:DATA.DataViewStream):BloodSprite[] {
  var dec = (((header3.mapRevisions * LOADER.spriteStruct.sizeof()) | 0x4d) & 0xFF);
  var sprites = [];
  var spriteReader = DATA.atomic_array(DATA.ubyte, LOADER.spriteStruct.sizeof());
  for (var i = 0; i < header3.numSprites; i++) {
    var buf = spriteReader.read(stream);
    decryptBuffer(buf, LOADER.spriteStruct.sizeof(), dec);
    var sprite = LOADER.spriteStruct.read(createStream(buf));
    sprites.push(sprite);
    if (sprite.extra != 0 && sprite.extra != 65535) {
      var spriteExtraReader = DATA.atomic_array(DATA.ubyte, 56);
      var buff = spriteExtraReader.read(stream);
      var spriteExtra = spriteExtraStruct.read(createStream(buff));
      (<BloodSprite> sprite).extraData = spriteExtra;
    }
  }
  return sprites;
}

function createBoard(version:number, header1:any, header3:any, sectors:BloodSector[], walls:BloodWall[], sprites:BloodSprite[]):BloodBoard {
  var brd = new BloodBoard();
  brd.version = version;
  brd.posx = header1.startX;
  brd.posy = header1.startY;
  brd.posz = header1.startZ;
  brd.ang = header1.startAng;
  brd.cursectnum = header1.startSec;
  brd.numsectors = header3.numSectors;
  brd.numwalls = header3.numWalls;
  brd.numsprites = header3.numSprites;
  brd.sectors = sectors;
  brd.walls = walls;
  brd.sprites = sprites;
  return brd;
}

export function loadBloodMap(stream:DATA.DataViewStream):BloodBoard {
  var header = DATA.int.read(stream);
  var version = DATA.short.read(stream);
  var buf = DATA.atomic_array(DATA.ubyte, header1Struct.sizeof()).read(stream);
  decryptBuffer(buf, header1Struct.sizeof(), 0x4d);
  var header1 = header1Struct.read(createStream(buf));
  stream.skip(header2Struct.sizeof());
  buf = DATA.atomic_array(DATA.ubyte, header3Struct.sizeof()).read(stream);
  decryptBuffer(buf, header3Struct.sizeof(), 0x68);
  var header3 = header3Struct.read(createStream(buf));
  stream.skip(128 + (1 << header1.unk)*2);

  var sectors = readSectors(header3, stream);
  var walls = readWalls(header3, stream);
  var sprites = readSprites(header3, stream);

  return createBoard(version, header1, header3, sectors, walls, sprites);
}