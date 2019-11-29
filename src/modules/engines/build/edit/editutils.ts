import { int, len2d, tuple2, tuple4 } from "../../../../libs/mathutils";
import { BuildContext } from "../api";
import { closestWallInSector, closestWallPointDist, closestWallSegmentInSector, DEFAULT_REPEAT_RATE, nextwall } from "../boardutils";
import { Hitscan, isSector, isSprite, isWall, EntityType, Entity, pointOnRay } from "../hitscan";
import { Board } from "../structs";
import { sectorOfWall, slope } from "../utils";
import { vec3 } from "../../../../libs_js/glmatrix";

export function invalidateSectorAndWalls(sectorId: number, ctx: BuildContext) {
  ctx.invalidator.invalidateSector(sectorId);
  let sec = ctx.board.sectors[sectorId];
  let end = sec.wallnum + sec.wallptr;
  for (let w = sec.wallptr; w < end; w++) {
    ctx.invalidator.invalidateWall(w);
    ctx.invalidator.invalidateWall(ctx.board.walls[w].nextwall);
  }
}

let target_ = vec3.create();
export function getClosestWall(board: Board, hit: Hitscan, d: number, twod: boolean): number {
  if (twod) {
    let [w, dist] = closestWallPointDist(board, hit.ray.start[0], hit.ray.start[1]);
    return dist <= d ? w : -1;
  }
  if (hit.ent == null) return -1;
  pointOnRay(target_, hit.ray, hit.t);
  if (hit.ent.isWall())
    return closestWallInSector(board, sectorOfWall(board, hit.ent.id), target_[0], target_[1], d);
  else if (hit.ent.isSector())
    return closestWallInSector(board, hit.ent.id, target_[0], target_[1], d);
  return -1;
}

let snapResult: [number, number, number, EntityType] = [0, 0, 0, null];
export function snap(ctx: BuildContext): [number, number, number, EntityType] {
  let hit = ctx.hitscan;
  let w = getClosestWall(ctx.board, hit, ctx.gridScale, ctx.state.get('view_2d'));
  if (w != -1) {
    let wall = ctx.board.walls[w];
    return tuple4(snapResult, wall.x, wall.y, w, EntityType.MID_WALL);
  }
  if (hit.t == -1) return null;
  pointOnRay(target_, hit.ray, hit.t);
  if (hit.ent.isSector()) {
    let w = closestWallSegmentInSector(ctx.board, hit.ent.id, target_[0], target_[1], ctx.gridScale);
    return w == -1 ? snapGrid(target_[0], target_[1], ctx, hit.ent) : snapWall(w, target_[0], target_[1], ctx);
  } else if (hit.ent.isSprite()) {
    return snapGrid(target_[0], target_[1], ctx, hit.ent);
  } else if (hit.ent.isWall()) {
    return snapWall(hit.ent.id, target_[0], target_[1], ctx);
  }
  return null;
}

function snapGrid(x: number, y: number, ctx: BuildContext, ent: Entity) {
  x = ctx.snap(x);
  y = ctx.snap(y);
  return tuple4(snapResult, x, y, ent.id, ent.type);
}

function snapWall(w: number, x: number, y: number, ctx: BuildContext) {
  let wall = ctx.board.walls[w];
  let w1 = nextwall(ctx.board, w);
  let wall1 = ctx.board.walls[w1];
  let dx = wall1.x - wall.x;
  let dy = wall1.y - wall.y;
  let repeat = DEFAULT_REPEAT_RATE * wall.xrepeat;
  let dxt = x - wall.x;
  let dyt = y - wall.y;
  let dt = len2d(dxt, dyt) / len2d(dx, dy);
  let t = ctx.snap(dt * repeat) / repeat;
  let xs = int(wall.x + (t * dx));
  let ys = int(wall.y + (t * dy));
  return tuple4(snapResult, xs, ys, w, EntityType.MID_WALL);
}

let sectorZesult: [EntityType, number] = [null, 0];
export function getClosestSectorZ(board: Board, sectorId: number, x: number, y: number, z: number): [EntityType, number] {
  let sector = board.sectors[sectorId];
  let fz = slope(board, sectorId, x, y, sector.floorheinum) + sector.floorz;
  let cz = slope(board, sectorId, x, y, sector.ceilingheinum) + sector.ceilingz;
  return Math.abs(z - fz) < Math.abs(z - cz) ? tuple2(sectorZesult, EntityType.FLOOR, fz) : tuple2(sectorZesult, EntityType.CEILING, cz);
}

