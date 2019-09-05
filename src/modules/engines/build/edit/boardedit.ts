import { Deck } from "../../../deck";
import { closestWallInSector, nextwall, splitWall } from "../boardutils";
import { Hitscan, isSector, isSprite, isWall, SubType } from "../hitscan";
import { MessageHandler } from "../messages";
import { Board } from "../structs";
import { createSlopeCalculator, sectorOfWall } from "../utils";
import { BuildContext, EndMove, Highlight, Move, StartMove } from "./editapi";
import { MovingHandle } from "./handle";
import { SectorEnt } from "./sector";
import { SpriteEnt } from "./sprite";
import { WallEnt } from "./wall";
import { WallSegmentsEnt } from "./wallsegment";

export class SplitWall {
  private x = 0;
  private y = 0;
  private wallId = -1;
  private active = false;

  public deactivate() {
    this.active = false;
  }

  public update(x: number, y: number, wallId: number) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.wallId = wallId;
  }

  public run(ctx: BuildContext) {
    if (!this.active) return;
    splitWall(ctx.board, this.wallId, this.x, this.y, ctx.art, []);
    let s = sectorOfWall(ctx.board, this.wallId);
    invalidateSector(s, ctx);
  }
}

class DrawWall {
  private wallId = -1;
  private fromFloor = true;
  private points = new Deck<number[]>();

  public start(board: Board, hit: Hitscan) {
    this.points.clear();
    this.wallId = hit.id;
    let s = sectorOfWall(board, this.wallId);
    let sec = board.sectors[s];
    let slope = createSlopeCalculator(sec, board.walls);
    let floorz = slope(hit.x, hit.y, sec.floorheinum) + sec.floorz;
    let ceilz = slope(hit.x, hit.y, sec.ceilingheinum) + sec.ceilingz;
    this.fromFloor = Math.abs(hit.z - floorz) < Math.abs(hit.z - ceilz);
    this.points.push([hit.x, hit.y, this.fromFloor ? floorz : ceilz]);
  }
}

export function invalidateSector(sectorId: number, ctx: BuildContext) {
  ctx.invalidateSector(sectorId);
  let sec = ctx.board.sectors[sectorId];
  let end = sec.wallnum + sec.wallptr;
  for (let w = sec.wallptr; w < end; w++) {
    ctx.invalidateWall(w);
    ctx.invalidateWall(ctx.board.walls[w].nextwall);
  }
}

let handle = new MovingHandle();
export let MOVE = new Move(handle);
export let START_MOVE = new StartMove(handle);
export let END_MOVE = new EndMove(handle);
export let HIGHLIGHT = new Highlight();

export let SPLIT_WALL = new SplitWall();
export let DRAW_WALL = new DrawWall();

function getClosestWall(board: Board, hit: Hitscan): number {
  if (isWall(hit.type)) {
    return closestWallInSector(board, sectorOfWall(board, hit.id), hit.x, hit.y, 64);
  } else if (isSector(hit.type)) {
    return closestWallInSector(board, hit.id, hit.x, hit.y, 64);
  }
  return -1;
}

function getAttacherSector(board: Board, hit: Hitscan): MessageHandler {
  let wall = board.walls[hit.id];
  let sectorId = wall.nextsector == -1 ? sectorOfWall(board, hit.id) : wall.nextsector;
  let sec = board.sectors[sectorId];
  let slope = createSlopeCalculator(sec, board.walls);
  let floorz = slope(hit.x, hit.y, sec.floorheinum) + sec.floorz;
  let ceilz = slope(hit.x, hit.y, sec.ceilingheinum) + sec.ceilingz;
  let type = Math.abs(hit.z - floorz) < Math.abs(hit.z - ceilz) ? SubType.FLOOR : SubType.CEILING;
  return SectorEnt.create(sectorId, type);
}

let list = new Deck<MessageHandler>();
let segment = new Deck<number>();
export function getFromHitscan(board: Board, hit: Hitscan): Deck<MessageHandler> {
  list.clear();
  let w = getClosestWall(board, hit);
  if (w != -1) {
    list.push(WallEnt.create(board, w));
    list.push(getAttacherSector(board, hit))
  } else if (isWall(hit.type)) {
    let w1 = nextwall(board, hit.id);
    segment.clear().push(hit.id).push(w1);
    list.push(WallSegmentsEnt.create(board, segment));
    list.push(getAttacherSector(board, hit))
  } else if (isSector(hit.type)) {
    list.push(SectorEnt.create(hit.id, hit.type));
  } else if (isSprite(hit.type)) {
    list.push(SpriteEnt.create(hit.id));
  }
  return list;
}
