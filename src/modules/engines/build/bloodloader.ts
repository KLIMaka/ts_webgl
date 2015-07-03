import data = require('../../../libs/dataviewstream');
import build = require('./structs');
import loader = require('./loader');


function decryptBuffer(buffer:number[], size:number, key:number) {
  for (var i = 0; i < size; i++)
    buffer[i] = buffer[i] ^ (key + i);
}

function createStream(buf:ArrayBuffer) {
  return new data.DataViewStream(new Uint8Array(buf).buffer, true);
}

var header1Struct = data.struct(Object, [
   ['startX', data.int],
   ['startY', data.int],
   ['startZ', data.int],
   ['startAng', data.short],
   ['startSec', data.short],
   ['unk', data.short],
]);

var header2Struct = data.struct(Object, [
  ['unk', data.array(data.ubyte, 9)],
]);

var header3Struct = data.struct(Object,[
  ['mapRevisions', data.int],
  ['numSectors', data.short],
  ['numWalls', data.short],
  ['numSprites', data.short],
]);

export function loadBloodMap(stream:data.DataViewStream):build.Board {
  var header = data.int.read(stream);
  var version = data.short.read(stream);
  var buf = data.array(data.ubyte, header1Struct.sizeof()).read(stream);
  decryptBuffer(buf, header1Struct.sizeof(), 0x4d);
  var header1 = header1Struct.read(createStream(buf));
  stream.skip(header2Struct.sizeof());
  buf = data.array(data.ubyte, header3Struct.sizeof()).read(stream);
  decryptBuffer(buf, header3Struct.sizeof(), 0x68);
  var header3 = header3Struct.read(createStream(buf));
  stream.skip(128 + (1 << header1.unk)*2);

  var dec = ((header3.mapRevisions * loader.sectorStruct.sizeof()) & 0xFF);
  var sectors = [];
  var sectorReader = data.array(data.ubyte, loader.sectorStruct.sizeof());
  for (var i = 0; i < header3.numSectors; i++) {
    buf = sectorReader.read(stream);
    decryptBuffer(buf, loader.sectorStruct.sizeof(), dec);
    var sector = loader.sectorStruct.read(createStream(buf));
    sectors.push(sector);
    if (sector.extra != 0 && sector.extra != 65535)
      stream.skip(60);
  }

  dec = (((header3.mapRevisions * loader.sectorStruct.sizeof()) | 0x4d) & 0xFF);
  var walls = [];
  var wallReader = data.array(data.ubyte, loader.wallStruct.sizeof());
  for (var i = 0; i < header3.numWalls; i++) {
    buf = wallReader.read(stream);
    decryptBuffer(buf, loader.wallStruct.sizeof(), dec);
    var wall = loader.wallStruct.read(createStream(buf));
    walls.push(wall);
    if (wall.extra != 0 && wall.extra != 65535)
      stream.skip(24);
  }

  dec = (((header3.mapRevisions * loader.spriteStruct.sizeof()) | 0x4d) & 0xFF);
  var sprites = [];
  var spriteReader = data.array(data.ubyte, loader.spriteStruct.sizeof());
  for (var i = 0; i < header3.numSprites; i++) {
    buf = spriteReader.read(stream);
    decryptBuffer(buf, loader.spriteStruct.sizeof(), dec);
    var sprite = loader.spriteStruct.read(createStream(buf));
    sprites.push(sprite);
    if (sprite.extra != 0 && sprite.extra != 65535)
      stream.skip(56);
  }

  var brd = new build.Board();
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