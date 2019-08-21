import * as data from '../../../libs/dataviewstream';
import * as build from './structs';

let sectorStats = data.struct(build.SectorStats, [
  ['parallaxing', data.bits(1)],
  ['slopped', data.bits(1)],
  ['swapXY', data.bits(1)],
  ['doubleSmooshiness', data.bits(1)],
  ['xflip', data.bits(1)],
  ['yflip', data.bits(1)],
  ['alignToFirstWall', data.bits(1)],
  ['_', data.bits(9)],
]);

export let sectorStruct = data.struct(build.Sector, [
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

let wallStats = data.struct(build.WallStats, [
  ['blocking', data.bits(1)],
  ['swapBottoms', data.bits(1)],
  ['alignBottom', data.bits(1)],
  ['xflip', data.bits(1)],
  ['masking', data.bits(1)],
  ['oneWay', data.bits(1)],
  ['blocking2', data.bits(1)],
  ['translucent', data.bits(1)],
  ['yflip', data.bits(1)],
  ['translucentReversed', data.bits(1)],
  ['_', data.bits(6)],
]);

export let wallStruct = data.struct(build.Wall, [
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
  ['xpanning', data.ubyte],
  ['ypanning', data.ubyte],
  ['lotag', data.ushort],
  ['hitag', data.ushort],
  ['extra', data.ushort]
]);

let spriteStats = data.struct(build.SpriteStats, [
  ['blocking', data.bits(1)],
  ['translucent', data.bits(1)],
  ['xflip', data.bits(1)],
  ['yflip', data.bits(1)],
  ['type', data.bits(2)],
  ['onesided', data.bits(1)],
  ['realCenter', data.bits(1)],
  ['blocking2', data.bits(1)],
  ['tranclucentReversed', data.bits(1)],
  ['noautoshading', data.bits(1)],
  ['_', data.bits(4)],
  ['invisible', data.bits(1)],
]);

export let spriteStruct = data.struct(build.Sprite, [
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

export let boardStruct = data.struct(build.Board, [
  ['version', data.uint],
  ['posx', data.int],
  ['posy', data.int],
  ['posz', data.int],
  ['ang', data.ushort],
  ['cursectnum', data.ushort]
]);

export function loadBuildMap(stream: data.DataViewStream): build.Board {
  let brd = boardStruct.read(stream);
  brd.numsectors = data.ushort.read(stream);
  brd.sectors = data.array(sectorStruct, brd.numsectors).read(stream);
  brd.numwalls = data.ushort.read(stream);
  brd.walls = data.array(wallStruct, brd.numwalls).read(stream);
  brd.numsprites = data.ushort.read(stream);
  brd.sprites = data.array(spriteStruct, brd.numsprites).read(stream);
  return brd;
}
