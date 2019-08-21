import { array, atomic_array, byte, DataViewStream, int, short, struct, ubyte } from '../../../libs/dataviewstream';
import { BloodBoard, BloodSector, BloodSprite, BloodWall, SectorExtra, SpriteExtra, WallExtra } from './bloodstructs';
import * as LOADER from './loader';
import { Header1 } from './structs';


function decryptBuffer(buffer: Uint8Array, size: number, key: number) {
  for (let i = 0; i < size; i++)
    buffer[i] = buffer[i] ^ (key + i);
}

function createStream(arr: Uint8Array) {
  return new DataViewStream(arr.buffer, true);
}

let header1Struct = struct(Header1, [
  ['startX', int],
  ['startY', int],
  ['startZ', int],
  ['startAng', short],
  ['startSec', short],
  ['unk', short],
]);

let header2Struct = struct(Object, [
  ['unk', array(ubyte, 9)],
]);

let header3Struct = struct(Object, [
  ['mapRevisions', int],
  ['numSectors', short],
  ['numWalls', short],
  ['numSprites', short],
]);

let sectorExtraStruct = struct(SectorExtra, [
  ['_', atomic_array(byte, 60)]
]);

let wallExtraStruct = struct(WallExtra, [
  ['_', atomic_array(byte, 24)]
]);

let spriteExtraStruct = struct(SpriteExtra, [
  ['_', atomic_array(byte, 15)],
  ['data1', short],
  ['data2', short],
  ['data3', short],
  ['_', atomic_array(byte, 35)],
]);

let sectorReader = atomic_array(ubyte, LOADER.sectorStruct.size);
function readSectors(header3: any, stream: DataViewStream): BloodSector[] {
  let dec = ((header3.mapRevisions * LOADER.sectorStruct.size) & 0xFF);
  let sectors = [];
  for (let i = 0; i < header3.numSectors; i++) {
    let buf = sectorReader.read(stream);
    decryptBuffer(buf, LOADER.sectorStruct.size, dec);
    let sector = <BloodSector>LOADER.sectorStruct.read(createStream(buf));
    sectors.push(sector);
    if (sector.extra != 0 && sector.extra != 65535)
      sector.extraData = sectorExtraStruct.read(stream);
  }
  return sectors;
}

let wallReader = atomic_array(ubyte, LOADER.wallStruct.size);
function readWalls(header3: any, stream: DataViewStream): BloodWall[] {
  let dec = (((header3.mapRevisions * LOADER.sectorStruct.size) | 0x4d) & 0xFF);
  let walls = [];
  for (let i = 0; i < header3.numWalls; i++) {
    let buf = wallReader.read(stream);
    decryptBuffer(buf, LOADER.wallStruct.size, dec);
    let wall = <BloodWall>LOADER.wallStruct.read(createStream(buf));
    walls.push(wall);
    if (wall.extra != 0 && wall.extra != 65535)
      wall.extraData = wallExtraStruct.read(stream);
  }
  return walls;
}

let spriteReader = atomic_array(ubyte, LOADER.spriteStruct.size);
function readSprites(header3: any, stream: DataViewStream): BloodSprite[] {
  let dec = (((header3.mapRevisions * LOADER.spriteStruct.size) | 0x4d) & 0xFF);
  let sprites = [];
  for (let i = 0; i < header3.numSprites; i++) {
    let buf = spriteReader.read(stream);
    decryptBuffer(buf, LOADER.spriteStruct.size, dec);
    let sprite = <BloodSprite>LOADER.spriteStruct.read(createStream(buf));
    sprites.push(sprite);
    if (sprite.extra != 0 && sprite.extra != 65535)
      sprite.extraData = spriteExtraStruct.read(stream);
  }
  return sprites;
}

function createBoard(version: number, header1: any, header3: any, sectors: BloodSector[], walls: BloodWall[], sprites: BloodSprite[]): BloodBoard {
  let brd = new BloodBoard();
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

export function loadBloodMap(stream: DataViewStream): BloodBoard {
  let header = int.read(stream);
  let version = short.read(stream);
  let buf = atomic_array(ubyte, header1Struct.size).read(stream);
  decryptBuffer(buf, header1Struct.size, 0x4d);
  let header1 = header1Struct.read(createStream(buf));
  stream.skip(header2Struct.size);
  buf = atomic_array(ubyte, header3Struct.size).read(stream);
  decryptBuffer(buf, header3Struct.size, 0x68);
  let header3 = header3Struct.read(createStream(buf));
  stream.skip(128 + (1 << header1.unk) * 2);

  let sectors = readSectors(header3, stream);
  let walls = readWalls(header3, stream);
  let sprites = readSprites(header3, stream);

  return createBoard(version, header1, header3, sectors, walls, sprites);
}