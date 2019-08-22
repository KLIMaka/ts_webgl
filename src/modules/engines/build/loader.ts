import * as build from './structs';
import { struct, bits, ushort, int, short, byte, ubyte, uint, DataViewStream, array } from '../../../libs/dataviewstream';

let sectorStats = struct(build.SectorStats, [
  ['parallaxing', bits(1)],
  ['slopped', bits(1)],
  ['swapXY', bits(1)],
  ['doubleSmooshiness', bits(1)],
  ['xflip', bits(1)],
  ['yflip', bits(1)],
  ['alignToFirstWall', bits(1)],
  ['_', bits(9)],
]);

export let sectorStruct = struct(build.Sector, [
  ['wallptr', ushort],
  ['wallnum', ushort],
  ['ceilingz', int],
  ['floorz', int],
  ['ceilingstat', sectorStats],
  ['floorstat', sectorStats],
  ['ceilingpicnum', ushort],
  ['ceilingheinum', short],
  ['ceilingshade', byte],
  ['ceilingpal', ubyte],
  ['ceilingxpanning', ubyte],
  ['ceilingypanning', ubyte],
  ['floorpicnum', ushort],
  ['floorheinum', short],
  ['floorshade', byte],
  ['floorpal', ubyte],
  ['floorxpanning', ubyte],
  ['floorypanning', ubyte],
  ['visibility', byte],
  ['filler', byte],
  ['lotag', ushort],
  ['hitag', ushort],
  ['extra', ushort]
]);

let wallStats = struct(build.WallStats, [
  ['blocking', bits(1)],
  ['swapBottoms', bits(1)],
  ['alignBottom', bits(1)],
  ['xflip', bits(1)],
  ['masking', bits(1)],
  ['oneWay', bits(1)],
  ['blocking2', bits(1)],
  ['translucent', bits(1)],
  ['yflip', bits(1)],
  ['translucentReversed', bits(1)],
  ['_', bits(6)],
]);

export let wallStruct = struct(build.Wall, [
  ['x', int],
  ['y', int],
  ['point2', ushort],
  ['nextwall', short],
  ['nextsector', short],
  ['cstat', wallStats],
  ['picnum', ushort],
  ['overpicnum', ushort],
  ['shade', byte],
  ['pal', ubyte],
  ['xrepeat', ubyte],
  ['yrepeat', ubyte],
  ['xpanning', ubyte],
  ['ypanning', ubyte],
  ['lotag', ushort],
  ['hitag', ushort],
  ['extra', ushort]
]);

let spriteStats = struct(build.SpriteStats, [
  ['blocking', bits(1)],
  ['translucent', bits(1)],
  ['xflip', bits(1)],
  ['yflip', bits(1)],
  ['type', bits(2)],
  ['onesided', bits(1)],
  ['realCenter', bits(1)],
  ['blocking2', bits(1)],
  ['tranclucentReversed', bits(1)],
  ['noautoshading', bits(1)],
  ['_', bits(4)],
  ['invisible', bits(1)],
]);

export let spriteStruct = struct(build.Sprite, [
  ['x', int],
  ['y', int],
  ['z', int],
  ['cstat', spriteStats],
  ['picnum', ushort],
  ['shade', byte],
  ['pal', ubyte],
  ['clipdist', ubyte],
  ['filler', ubyte],
  ['xrepeat', ubyte],
  ['yrepeat', ubyte],
  ['xoffset', ubyte],
  ['yoffset', ubyte],
  ['sectnum', ushort],
  ['statnum', ushort],
  ['ang', ushort],
  ['owner', ushort],
  ['xvel', short],
  ['yvel', short],
  ['zvel', short],
  ['lotag', ushort],
  ['hitag', ushort],
  ['extra', ushort]
]);

export let boardStruct = struct(build.Board, [
  ['version', uint],
  ['posx', int],
  ['posy', int],
  ['posz', int],
  ['ang', ushort],
  ['cursectnum', ushort]
]);

export function loadBuildMap(stream: DataViewStream): build.Board {
  let brd = boardStruct.read(stream);
  brd.numsectors = ushort.read(stream);
  brd.sectors = array(sectorStruct, brd.numsectors).read(stream);
  brd.numwalls = ushort.read(stream);
  brd.walls = array(wallStruct, brd.numwalls).read(stream);
  brd.numsprites = ushort.read(stream);
  brd.sprites = array(spriteStruct, brd.numsprites).read(stream);
  return brd;
}
