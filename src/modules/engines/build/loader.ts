import data = require('../../../libs/dataviewstream');
import build = require('./structs');

var sectorStruct = data.structCreator(build.Sector, [
  ['wallptr', data.ushort],
  ['wallnum', data.ushort],
  ['ceilingz', data.int],
  ['floorz', data.int],
  ['ceilingstat', data.ushort],
  ['floorstat', data.ushort],
  ['ceilingpicnum', data.ushort],
  ['ceilingheinum', data.short],
  ['ceilingshade', data.byte],
  ['ceilingpal', data.ubyte],
  ['ceilingxpanning', data.ubyte],
  ['ceilingypanning', data.ubyte],
  ['floorpicnum', data.ushort],
  ['floorheinum', data.short],
  ['floorshade', data.byte],
  ['floorpal', data.ubyte],
  ['floorxpanning', data.ubyte],
  ['floorypanning', data.ubyte],
  ['visibility', data.byte],
  ['filler', data.byte],
  ['lotag', data.ushort],
  ['hitag', data.ushort],
  ['extra', data.ushort]
]);

var wallStruct = data.structCreator(build.Wall, [
  ['x', data.int],
  ['y', data.int],
  ['point2', data.ushort],
  ['nextwall', data.short],
  ['nextsector', data.short],
  ['cstat', data.ushort],
  ['picnum', data.ushort],
  ['overpicnum', data.ushort],
  ['shade', data.byte],
  ['pal', data.ubyte],
  ['xrepeat', data.ubyte],
  ['yrepeat', data.ubyte],
  ['xpanning', data.ubyte],
  ['ypanning', data.ubyte],
  ['lotag', data.ushort],
  ['hitag', data.ushort],
  ['extra', data.ushort]
]);

var spriteStruct = data.structCreator(build.Sprite, [
  ['x', data.int],
  ['y', data.int],
  ['z', data.int],
  ['cstat', data.ushort],
  ['picnum', data.ushort],
  ['shade', data.byte],
  ['pal', data.ubyte],
  ['clipdist', data.ubyte],
  ['filler', data.ubyte],
  ['xrepeat', data.byte],
  ['yrepeat', data.byte],
  ['xoffset', data.ubyte],
  ['yoffset', data.ubyte],
  ['sectnum', data.ushort],
  ['statnum', data.ushort],
  ['ang', data.ushort],
  ['owner', data.ushort],
  ['xvel', data.short],
  ['yvel', data.short],
  ['zvel', data.short],
  ['lotag', data.ushort],
  ['hitag', data.ushort],
  ['extra', data.ushort]
]);

function readSectors(buf:data.DataViewStream, numsectors:number):build.Sector[] {
  var sectors = new Array<build.Sector>(numsectors);
  for (var i = 0; i < numsectors; i++) {
    sectors[i] = <build.Sector> sectorStruct(buf);
  }
  return sectors;
}

function readWalls(buf:data.DataViewStream, numwals:number):build.Wall[] {
  var walls = new Array<build.Wall>(numwals);
  for (var i = 0; i < numwals; i++) {
    walls[i] = <build.Wall> wallStruct(buf);
  }
  return walls;
};

function readSprites(buf:data.DataViewStream, numsprites:number):build.Sprite[] {
  var sprites = new Array<build.Sprite>(numsprites);
  for (var i = 0; i < numsprites; i++) {
    sprites[i] = <build.Sprite> spriteStruct(buf);
  }
  return sprites;
};

export function loadBuildMap(stream:data.DataViewStream):build.Board {
  var board = new build.Board();

  board.version = stream.readUInt();
  board.posx = stream.readInt();
  board.posy = stream.readInt();
  board.posz = stream.readInt();
  board.ang = stream.readUShort();
  board.cursectnum = stream.readUShort();

  board.numsectors = stream.readUShort();
  board.sectors = readSectors(stream, board.numsectors);

  board.numwalls = stream.readUShort();
  board.walls = readWalls(stream, board.numwalls);

  board.numsprites = stream.readUShort();
  board.sprites = readSprites(stream, board.numsprites);

  return board;
}
