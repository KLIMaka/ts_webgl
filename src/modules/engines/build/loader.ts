import * as build from './structs';
import { struct, bits, ushort, int, short, byte, ubyte, uint, Stream, array } from '../../../libs/stream';

let sectorStats = struct(build.SectorStats)
  .field('parallaxing', bits(1))
  .field('slopped', bits(1))
  .field('swapXY', bits(1))
  .field('doubleSmooshiness', bits(1))
  .field('xflip', bits(1))
  .field('yflip', bits(1))
  .field('alignToFirstWall', bits(1))
  .field('unk', bits(9));

export let sectorStruct = struct(build.Sector)
  .field('wallptr', ushort)
  .field('wallnum', ushort)
  .field('ceilingz', int)
  .field('floorz', int)
  .field('ceilingstat', sectorStats)
  .field('floorstat', sectorStats)
  .field('ceilingpicnum', ushort)
  .field('ceilingheinum', short)
  .field('ceilingshade', byte)
  .field('ceilingpal', ubyte)
  .field('ceilingxpanning', ubyte)
  .field('ceilingypanning', ubyte)
  .field('floorpicnum', ushort)
  .field('floorheinum', short)
  .field('floorshade', byte)
  .field('floorpal', ubyte)
  .field('floorxpanning', ubyte)
  .field('floorypanning', ubyte)
  .field('visibility', byte)
  .field('filler', byte)
  .field('lotag', ushort)
  .field('hitag', ushort)
  .field('extra', ushort);

let wallStats = struct(build.WallStats)
  .field('blocking', bits(1))
  .field('swapBottoms', bits(1))
  .field('alignBottom', bits(1))
  .field('xflip', bits(1))
  .field('masking', bits(1))
  .field('oneWay', bits(1))
  .field('blocking2', bits(1))
  .field('translucent', bits(1))
  .field('yflip', bits(1))
  .field('translucentReversed', bits(1))
  .field('unk', bits(6));

export let wallStruct = struct(build.Wall)
  .field('x', int)
  .field('y', int)
  .field('point2', ushort)
  .field('nextwall', short)
  .field('nextsector', short)
  .field('cstat', wallStats)
  .field('picnum', ushort)
  .field('overpicnum', ushort)
  .field('shade', byte)
  .field('pal', ubyte)
  .field('xrepeat', ubyte)
  .field('yrepeat', ubyte)
  .field('xpanning', ubyte)
  .field('ypanning', ubyte)
  .field('lotag', ushort)
  .field('hitag', ushort)
  .field('extra', ushort);

let spriteStats = struct(build.SpriteStats)
  .field('blocking', bits(1))
  .field('translucent', bits(1))
  .field('xflip', bits(1))
  .field('yflip', bits(1))
  .field('type', bits(2))
  .field('onesided', bits(1))
  .field('realCenter', bits(1))
  .field('blocking2', bits(1))
  .field('tranclucentReversed', bits(1))
  .field('noautoshading', bits(1))
  .field('unk', bits(4))
  .field('invisible', bits(1));

export let spriteStruct = struct(build.Sprite)
  .field('x', int)
  .field('y', int)
  .field('z', int)
  .field('cstat', spriteStats)
  .field('picnum', ushort)
  .field('shade', byte)
  .field('pal', ubyte)
  .field('clipdist', ubyte)
  .field('filler', ubyte)
  .field('xrepeat', ubyte)
  .field('yrepeat', ubyte)
  .field('xoffset', ubyte)
  .field('yoffset', ubyte)
  .field('sectnum', ushort)
  .field('statnum', ushort)
  .field('ang', ushort)
  .field('owner', ushort)
  .field('xvel', short)
  .field('yvel', short)
  .field('zvel', short)
  .field('lotag', ushort)
  .field('hitag', ushort)
  .field('extra', ushort);

export let boardStruct = struct(build.Board)
  .field('version', uint)
  .field('posx', int)
  .field('posy', int)
  .field('posz', int)
  .field('ang', ushort)
  .field('cursectnum', ushort);

export function loadBuildMap(stream: Stream): build.Board {
  let brd = boardStruct.read(stream);
  brd.numsectors = ushort.read(stream);
  brd.sectors = array(sectorStruct, brd.numsectors).read(stream);
  brd.numwalls = ushort.read(stream);
  brd.walls = array(wallStruct, brd.numwalls).read(stream);
  brd.numsprites = ushort.read(stream);
  brd.sprites = array(spriteStruct, brd.numsprites).read(stream);
  return brd;
}
