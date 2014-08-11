import data = require('../../../libs/dataviewstream');
import build = require('./structs');

function readSectors(buf:data.DataViewStream, numsectors:number):build.Sector[] {
  var sectors = new Array<build.Sector>(numsectors);
  for (var i = 0; i < numsectors; i++) {
    var sector = new build.Sector();
    sectors[i] = sector;
    sector.wallptr = buf.readUShort();
    sector.wallnum = buf.readUShort();
    sector.ceilingz = buf.readInt();
    sector.floorz = buf.readInt();
    sector.ceilingstat = buf.readUShort();
    sector.floorstat = buf.readUShort();
    sector.ceilingpicnum = buf.readUShort();
    sector.ceilingheinum = buf.readShort();
    sector.ceilingshade = buf.readByte();
    sector.ceilingpal = buf.readUByte();
    sector.ceilingxpanning = buf.readUByte();
    sector.ceilingypanning = buf.readUByte();
    sector.floorpicnum = buf.readUShort();
    sector.floorheinum = buf.readShort();
    sector.floorshade = buf.readByte();
    sector.floorpal = buf.readUByte();
    sector.floorxpanning = buf.readUByte();
    sector.floorypanning = buf.readUByte();
    sector.visibility = buf.readByte();
    sector.filler = buf.readByte();
    sector.lotag = buf.readUShort();
    sector.hitag = buf.readUShort();
    sector.extra = buf.readUShort();
  }
  return sectors;
}

function readWalls(buf:data.DataViewStream, numwals:number):build.Wall[] {
  var walls = new Array<build.Wall>(numwals);
  for (var i = 0; i < numwals; i++) {
    var wall = new build.Wall();
    walls[i] = wall;
    wall.x = buf.readInt();
    wall.y = buf.readInt();
    wall.point2 = buf.readUShort();
    wall.nextwall = buf.readShort();
    wall.nextsector = buf.readShort();
    wall.cstat = buf.readUShort();
    wall.picnum = buf.readUShort();
    wall.overpicnum = buf.readUShort();
    wall.shade = buf.readByte();
    wall.pal = buf.readUByte();
    wall.xrepeat = buf.readUByte();
    wall.yrepeat = buf.readUByte();
    wall.xpanning = buf.readUByte();
    wall.ypanning = buf.readUByte();
    wall.lotag = buf.readUShort();
    wall.hitag = buf.readUShort();
    wall.extra = buf.readUShort();
  }
  return walls;
};

function readSprites(buf:data.DataViewStream, numsprites:number):build.Sprite[] {
  var sprites = new Array<build.Sprite>(numsprites);
  for (var i = 0; i < numsprites; i++) {
    var sprite = new build.Sprite();
    sprites[i] = sprite;
    sprite.x = buf.readInt();
    sprite.y = buf.readInt();
    sprite.z = buf.readInt();
    sprite.cstat = buf.readUShort();
    sprite.picnum = buf.readUShort();
    sprite.shade = buf.readByte();
    sprite.pal = buf.readUByte();
    sprite.clipdist = buf.readUByte();
    sprite.filler = buf.readUByte();
    sprite.xrepeat = buf.readByte();
    sprite.yrepeat = buf.readByte();
    sprite.xoffset = buf.readUByte();
    sprite.yoffset = buf.readUByte();
    sprite.sectnum = buf.readUShort();
    sprite.statnum = buf.readUShort();
    sprite.ang = buf.readUShort();
    sprite.owner = buf.readUShort();
    sprite.xvel = buf.readUShort();
    sprite.yvel = buf.readUShort();
    sprite.zvel = buf.readUShort();
    sprite.lotag = buf.readUShort();
    sprite.hitag = buf.readUShort();
    sprite.extra = buf.readUShort();
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
