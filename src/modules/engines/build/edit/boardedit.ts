import { Deck } from "../../../deck";
import { closestWallInSector, nextwall } from "../boardutils";
import { ArtProvider } from "../gl/cache";
import { Hitscan, isSector, isSprite, isWall, SubType } from "../hitscan";
import { Message, MessageHandler } from "../messages";
import { Board } from "../structs";
import { createSlopeCalculator, sectorOfWall } from "../utils";
import { SectorEnt } from "./sector";
import { SpriteEnt } from "./sprite";
import { WallEnt } from "./wall";
import { WallSegmentsEnt } from "./wallsegment";
import { MovingHandle } from "./handle";

export interface BuildContext {
  art: ArtProvider;
  gl: WebGLRenderingContext;
  board: Board;

  snap(x: number): number;
  scaledSnap(x: number, scale: number): number;
  invalidateAll(): void;
  invalidateSector(id: number): void;
  invalidateWall(id: number): void;
  invalidateSprite(id: number): void;
  highlightSector(gl: WebGLRenderingContext, board: Board, sectorId: number): void;
  highlightWallSegment(gl: WebGLRenderingContext, board: Board, wallId: number, sectorId: number): void;
  highlightWall(gl: WebGLRenderingContext, board: Board, wallId: number): void;
  highlightSprite(gl: WebGLRenderingContext, board: Board, spriteId: number): void;
  highlight(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: SubType): void;
}

export class StartMove implements Message { constructor(public handle: MovingHandle) { } }
export class Move implements Message { constructor(public handle: MovingHandle) { } }
export class EndMove implements Message { constructor(public handle: MovingHandle) { } }
export class Highlight implements Message { }
export class SplitWall implements Message { x: number; y: number; wallId: number; }

class DrawWall implements Message {
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

let list = new Deck<MessageHandler>();
let segment = new Deck<number>();
export function getFromHitscan(board: Board, hit: Hitscan): Deck<MessageHandler> {
  list.clear();
  let w = getClosestWall(board, hit);
  if (w != -1) {
    list.push(WallEnt.create(w));
  } else if (isWall(hit.type)) {
    let w1 = nextwall(board, hit.id);
    list.push(WallSegmentsEnt.create(segment.clear().push(hit.id).push(w1)));
  } else if (isSector(hit.type)) {
    list.push(SectorEnt.create(hit.id, hit.type));
  } else if (isSprite(hit.type)) {
    list.push(SpriteEnt.create(hit.id));
  }
  return list;
}
