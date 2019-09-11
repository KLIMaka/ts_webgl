import { int, len2d } from "../../../../libs/mathutils";
import { DEFAULT_REPEAT_RATE, nextwall, closestWallInSector } from "../boardutils";
import { Hitscan, isSector, isWall, SubType } from "../hitscan";
import { Board } from "../structs";
import { slope, sectorOfWall } from "../utils";
import { BuildContext } from "./editapi";

export function invalidateSectorAndWalls(sectorId: number, ctx: BuildContext) {
  ctx.invalidateSector(sectorId);
  let sec = ctx.board.sectors[sectorId];
  let end = sec.wallnum + sec.wallptr;
  for (let w = sec.wallptr; w < end; w++) {
    ctx.invalidateWall(w);
    ctx.invalidateWall(ctx.board.walls[w].nextwall);
  }
}

export function getClosestWall(board: Board, hit: Hitscan, ctx: BuildContext): number {
  if (isWall(hit.type))
    return closestWallInSector(board, sectorOfWall(board, hit.id), hit.x, hit.y, ctx.snapScale());
  else if (isSector(hit.type))
    return closestWallInSector(board, hit.id, hit.x, hit.y, ctx.snapScale());
  return -1;
}

export function snap(board: Board, hit: Hitscan, ctx: BuildContext): [number, number] {
  let w = getClosestWall(board, hit, ctx);
  if (w != -1) {
    let wall = board.walls[w];
    return [wall.x, wall.y];
  } else if (isSector(hit.type)) {
    let x = ctx.snap(hit.x);
    let y = ctx.snap(hit.y);
    return [x, y];
  } else if (isWall(hit.type)) {
    let w = hit.id;
    let wall = board.walls[w];
    let w1 = nextwall(board, w);
    let wall1 = board.walls[w1];
    let dx = wall1.x - wall.x;
    let dy = wall1.y - wall.y;
    let repeat = DEFAULT_REPEAT_RATE * wall.xrepeat;
    let dxt = hit.x - wall.x;
    let dyt = hit.y - wall.y;
    let dt = len2d(dxt, dyt) / len2d(dx, dy);
    let t = ctx.snap(dt * repeat) / repeat;
    let x = int(wall.x + (t * dx));
    let y = int(wall.y + (t * dy));
    return [x, y];
  }
}

export function getClosestSectorZ(board: Board, sectorId: number, x: number, y: number, z: number): [SubType, number] {
  let sector = board.sectors[sectorId];
  let fz = slope(board, sectorId, x, y, sector.floorheinum) + sector.floorz;
  let cz = slope(board, sectorId, x, y, sector.ceilingheinum) + sector.ceilingz;
  return Math.abs(z - fz) < Math.abs(z - cz) ? [SubType.FLOOR, fz] : [SubType.CEILING, cz];
}

