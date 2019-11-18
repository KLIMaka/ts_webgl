import { int, len2d, tuple2, tuple4 } from "../../../../libs/mathutils";
import { BuildContext } from "../api";
import { closestWallInSector, closestWallPoint, closestWallSegmentInSector, DEFAULT_REPEAT_RATE, nextwall } from "../boardutils";
import { Hitscan, isSector, isSprite, isWall, SubType } from "../hitscan";
import { Board } from "../structs";
import { sectorOfWall, slope } from "../utils";

export function invalidateSectorAndWalls(sectorId: number, ctx: BuildContext) {
  ctx.invalidator.invalidateSector(sectorId);
  let sec = ctx.board.sectors[sectorId];
  let end = sec.wallnum + sec.wallptr;
  for (let w = sec.wallptr; w < end; w++) {
    ctx.invalidator.invalidateWall(w);
    ctx.invalidator.invalidateWall(ctx.board.walls[w].nextwall);
  }
}

export function getClosestWall(board: Board, hit: Hitscan, d: number, twod: boolean): number {
  if (twod) {
    let [w, dist] = closestWallPoint(board, hit.start[0], hit.start[1]);
    return dist <= d ? w : -1;
  } else if (isWall(hit.type))
    return closestWallInSector(board, sectorOfWall(board, hit.id), hit.x, hit.y, d);
  else if (isSector(hit.type))
    return closestWallInSector(board, hit.id, hit.x, hit.y, d);
  return -1;
}

let snapResult: [number, number, number, SubType] = [0, 0, 0, null];
export function snap(ctx: BuildContext): [number, number, number, SubType] {
  let hit = ctx.hitscan;
  let w = getClosestWall(ctx.board, hit, ctx.gridScale, ctx.state.get('view_2d'));
  if (w != -1) {
    let wall = ctx.board.walls[w];
    return tuple4(snapResult, wall.x, wall.y, w, SubType.MID_WALL);
  } else if (isSector(hit.type)) {
    let w = closestWallSegmentInSector(ctx.board, hit.id, hit.x, hit.y, ctx.gridScale);
    return w == -1 ? snapGrid(hit, ctx, hit.id, hit.type) : snapWall(w, hit, ctx);
  } else if (isSprite(hit.type)) {
    return snapGrid(hit, ctx, hit.id, hit.type);
  } else if (isWall(hit.type)) {
    return snapWall(hit.id, hit, ctx);
  }
  return null;
}

function snapGrid(hit: Hitscan, ctx: BuildContext, id: number, type: SubType) {
  let x = ctx.snap(hit.x);
  let y = ctx.snap(hit.y);
  return tuple4(snapResult, x, y, id, type);
}

function snapWall(w: number, hit: Hitscan, ctx: BuildContext) {
  let wall = ctx.board.walls[w];
  let w1 = nextwall(ctx.board, w);
  let wall1 = ctx.board.walls[w1];
  let dx = wall1.x - wall.x;
  let dy = wall1.y - wall.y;
  let repeat = DEFAULT_REPEAT_RATE * wall.xrepeat;
  let dxt = hit.x - wall.x;
  let dyt = hit.y - wall.y;
  let dt = len2d(dxt, dyt) / len2d(dx, dy);
  let t = ctx.snap(dt * repeat) / repeat;
  let x = int(wall.x + (t * dx));
  let y = int(wall.y + (t * dy));
  return tuple4(snapResult, x, y, w, SubType.MID_WALL);
}

let sectorZesult: [SubType, number] = [null, 0];
export function getClosestSectorZ(board: Board, sectorId: number, x: number, y: number, z: number): [SubType, number] {
  let sector = board.sectors[sectorId];
  let fz = slope(board, sectorId, x, y, sector.floorheinum) + sector.floorz;
  let cz = slope(board, sectorId, x, y, sector.ceilingheinum) + sector.ceilingz;
  return Math.abs(z - fz) < Math.abs(z - cz) ? tuple2(sectorZesult, SubType.FLOOR, fz) : tuple2(sectorZesult, SubType.CEILING, cz);
}

