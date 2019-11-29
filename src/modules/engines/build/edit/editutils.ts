import { tuple2 } from "../../../../libs/mathutils";
import { BuildContext } from "../api";
import { EntityType } from "../hitscan";
import { Board } from "../structs";
import { slope } from "../utils";

export function invalidateSectorAndWalls(sectorId: number, ctx: BuildContext) {
  ctx.invalidator.invalidateSector(sectorId);
  let sec = ctx.board.sectors[sectorId];
  let end = sec.wallnum + sec.wallptr;
  for (let w = sec.wallptr; w < end; w++) {
    ctx.invalidator.invalidateWall(w);
    ctx.invalidator.invalidateWall(ctx.board.walls[w].nextwall);
  }
}

let sectorZesult: [EntityType, number] = [null, 0];
export function getClosestSectorZ(board: Board, sectorId: number, x: number, y: number, z: number): [EntityType, number] {
  let sector = board.sectors[sectorId];
  let fz = slope(board, sectorId, x, y, sector.floorheinum) + sector.floorz;
  let cz = slope(board, sectorId, x, y, sector.ceilingheinum) + sector.ceilingz;
  return Math.abs(z - fz) < Math.abs(z - cz) ? tuple2(sectorZesult, EntityType.FLOOR, fz) : tuple2(sectorZesult, EntityType.CEILING, cz);
}

