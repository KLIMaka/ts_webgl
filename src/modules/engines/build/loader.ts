import data = require('../../../libs/dataviewstream');
import build = require('./structs');

var sectorStats = data.struct(build.SectorStats, [[
  'parallaxing,slopped,swapXY,doubleSmooshiness,xflip,yflip,alignToFirstWall,_', 
  data.bit_field([1,1,1,1,1,1,1,9], true)]]
 );

export var sectorStruct = data.struct(build.Sector,[
    ['wallptr', data.ushort],
    ['wallnum', data.ushort],
    ['ceilingz', data.int],
    ['floorz', data.int],
    ['ceilingstat', sectorStats],
    ['floorstat', sectorStats],
    ['ceilingpicnum', data.ushort],
    ['ceilingheinum', data.short],
    ['ceilingshade', data.byte],
    ['ceilingpal', data.ubyte],
    ['ceilingxpanning', data.byte],
    ['ceilingypanning', data.byte],
    ['floorpicnum', data.ushort],
    ['floorheinum', data.short],
    ['floorshade', data.byte],
    ['floorpal', data.ubyte],
    ['floorxpanning', data.byte],
    ['floorypanning', data.byte],
    ['visibility', data.byte],
    ['filler', data.byte],
    ['lotag', data.ushort],
    ['hitag', data.ushort],
    ['extra', data.ushort]
  ]);

var wallStats = data.struct(build.WallStats, [[
  'blocking,swapBottoms,alignBottom,xflip,masking,oneWay,blocking2,translucent,yflip,translucentReversed,_', 
  data.bit_field([1,1,1,1,1,1,1,1,1,1,6], true)]]
 );

export var wallStruct =  data.struct(build.Wall,[
    ['x', data.int],
    ['y', data.int],
    ['point2', data.ushort],
    ['nextwall', data.short],
    ['nextsector', data.short],
    ['cstat', wallStats],
    ['picnum', data.ushort],
    ['overpicnum', data.ushort],
    ['shade', data.byte],
    ['pal', data.ubyte],
    ['xrepeat', data.ubyte],
    ['yrepeat', data.ubyte],
    ['xpanning', data.byte],
    ['ypanning', data.byte],
    ['lotag', data.ushort],
    ['hitag', data.ushort],
    ['extra', data.ushort]
  ]);

var spriteStats = data.struct(build.SpriteStats, [[
  'blocking,translucent,xflip,yflip,type,onesided,realCenter,blocking2,tranclucentReversed,_,invicible', 
  data.bit_field([1,1,1,1,2,1,1,1,1,5,1], true)]]
 );

export var spriteStruct = data.struct(build.Sprite,[
    ['x', data.int],
    ['y', data.int],
    ['z', data.int],
    ['cstat', spriteStats],
    ['picnum', data.ushort],
    ['shade', data.byte],
    ['pal', data.ubyte],
    ['clipdist', data.ubyte],
    ['filler', data.ubyte],
    ['xrepeat', data.ubyte],
    ['yrepeat', data.ubyte],
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

export var boardStruct = data.struct(build.Board, [
  ['version', data.uint],
  ['posx', data.int],
  ['posy', data.int],
  ['posz', data.int],
  ['ang', data.ushort],
  ['cursectnum', data.ushort]
]);

export function loadBuildMap(stream:data.DataViewStream):build.Board {
  var brd = boardStruct.read(stream);
  brd.numsectors = data.ushort.read(stream);
  brd.sectors = data.array(sectorStruct, brd.numsectors).read(stream);
  brd.numwalls = data.ushort.read(stream);
  brd.walls = data.array(wallStruct, brd.numwalls).read(stream);
  brd.numsprites = data.ushort.read(stream);
  brd.sprites = data.array(spriteStruct, brd.numsprites).read(stream);
  return brd;
}
