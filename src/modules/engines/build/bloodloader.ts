import { array, atomic_array, byte, Stream, int, short, struct, ubyte } from '../../../libs/stream';
import { BloodBoard, BloodSector, BloodSprite, BloodWall, SectorExtra, SpriteExtra, WallExtra } from './bloodstructs';
import * as LOADER from './loader';
import { Header1 } from './structs';


function decryptBuffer(buffer: Uint8Array, size: number, key: number) {
  for (let i = 0; i < size; i++)
    buffer[i] = buffer[i] ^ (key + i);
}

function createStream(arr: Uint8Array) {
  return new Stream(arr.buffer, true);
}

let header1Struct = struct(Header1)
  .field('startX', int)
  .field('startY', int)
  .field('startZ', int)
  .field('startAng', short)
  .field('startSec', short)
  .field('unk', short);

let header2Struct = array(ubyte, 9);

class Header3 {
  public mapRevisions: number;
  public numSectors: number;
  public numWalls: number;
  public numSprites: number;
}

let header3Struct = struct(Header3)
  .field('mapRevisions', int)
  .field('numSectors', short)
  .field('numWalls', short)
  .field('numSprites', short);

let sectorExtraStruct = struct(SectorExtra)
  .field('unk', atomic_array(byte, 60));

let wallExtraStruct = struct(WallExtra)
  .field('unk', atomic_array(byte, 24));

let spriteExtraStruct = struct(SpriteExtra)
  .field('unk', atomic_array(byte, 15))
  .field('data1', short)
  .field('data2', short)
  .field('data3', short)
  .field('unk', atomic_array(byte, 35));

let sectorReader = atomic_array(ubyte, LOADER.sectorStruct.size);
function readSectors(header3: Header3, stream: Stream): BloodSector[] {
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
function readWalls(header3: any, stream: Stream): BloodWall[] {
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
function readSprites(header3: any, stream: Stream): BloodSprite[] {
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

export function loadBloodMap(stream: Stream): BloodBoard {
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