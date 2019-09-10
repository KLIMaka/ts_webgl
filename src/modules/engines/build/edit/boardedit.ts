import { Deck } from "../../../deck";
import { closestWallInSector, nextwall, splitWall, DEFAULT_REPEAT_RATE, pointOnWall } from "../boardutils";
import { Hitscan, isSector, isSprite, isWall, SubType } from "../hitscan";
import { MessageHandler } from "../messages";
import { Board, FLOOR } from "../structs";
import { createSlopeCalculator, sectorOfWall, slope, ZSCALE } from "../utils";
import { BuildContext, EndMove, Highlight, Move, StartMove } from "./editapi";
import { MovingHandle } from "./handle";
import { SectorEnt } from "./sector";
import { SpriteEnt } from "./sprite";
import { WallEnt } from "./wall";
import { WallSegmentsEnt } from "./wallsegment";
import * as GLM from "../../../../libs_js/glmatrix";
import { Context } from "../gl/context";
import { len2d, int } from "../../../../libs/mathutils";
import * as BGL from '../gl/buildgl';
import { Wireframe, Renderable, RenderableList } from "../gl/renderable";
import { init } from "../gl/buffers";

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

class DrawSector {
  private points = new Deck<[number, number]>();
  private z = 0;
  private pointer = GLM.vec3.create();
  private direction = GLM.vec3.create();
  private active = false;
  private valid = false;
  private cursor = new Wireframe();
  private contour = new Wireframe();
  private contourPoints = new Wireframe();
  private renderable = new RenderableList([this.cursor, this.contour, this.contourPoints]);

  public update(board: Board, hit: Hitscan, context: Context) {
    this.updatePointerUnactive(board, hit, context);
  }

  public insertPoint() {
    if (!this.valid) return;
    if (!this.active) this.startDraw();
    this.points.push([this.pointer[0], this.pointer[1]]);
  }

  private startDraw() {
    this.active = true;
    this.z = this.pointer[2];
    this.points.clear();
  }

  private updatePointerUnactive(board: Board, hit: Hitscan, context: Context) {
    if (hit.t == -1) {
      this.valid = false;
    } else {
      this.valid = true;
      let [x, y] = snap(board, hit, context);
      GLM.vec3.set(this.pointer, x, y, this.getPointerZ(board, hit, x, y));
    }
  }

  private getPointerZ(board: Board, hit: Hitscan, x: number, y: number) {
    if (isSector(hit.type)) {
      return hit.z;
    } else if (isWall(hit.type)) {
      return getClosestSectorZ(board, sectorOfWall(board, hit.id), x, y, hit.z)[1];
    } else if (isSprite(hit.type)) {
      let sprite = board.sprites[hit.id];
      return getClosestSectorZ(board, sprite.sectnum, x, y, hit.z)[1];
    }
  }

  public getRenderable(): Renderable {
    if (this.valid) {
      this.cursor.mode = WebGLRenderingContext.TRIANGLES;
      let buff = this.cursor.buff;
      buff.allocate(4, 12);
      let d = 32;
      let [x, y, z] = this.pointer;
      buff.writePos(0, x - d, z / ZSCALE, y - d);
      buff.writePos(1, x + d, z / ZSCALE, y - d);
      buff.writePos(2, x + d, z / ZSCALE, y + d);
      buff.writePos(3, x - d, z / ZSCALE, y + d);
      buff.writeQuad(0, 0, 1, 2, 3);
      buff.writeQuad(6, 3, 2, 1, 0);
    }
    if (this.active) {
      this.updateContour();
      this.updateContourPoints();
    }
    return this.renderable;
  }

  private updateContourPoints(): Renderable {
    let points = this.points.length();
    this.contourPoints.mode = WebGLRenderingContext.TRIANGLES;
    let buff = this.contourPoints.buff;
    buff.allocate(points * 4, points * 12);
    let d = 16;
    for (let i = 0; i < points; i++) {
      let p = this.points.get(i);
      let off = i * 4;
      buff.writePos(off + 0, p[0] - d, this.z / ZSCALE, p[1] - d);
      buff.writePos(off + 1, p[0] + d, this.z / ZSCALE, p[1] - d);
      buff.writePos(off + 2, p[0] + d, this.z / ZSCALE, p[1] + d);
      buff.writePos(off + 3, p[0] - d, this.z / ZSCALE, p[1] + d);
      buff.writeQuad(i * 12 + 0, off, off + 1, off + 2, off + 3);
      buff.writeQuad(i * 12 + 6, off + 3, off + 2, off + 1, off);
    }
    return this.contourPoints;
  }

  private updateContour(): Renderable {
    let points = this.points.length() + 1;
    let buff = this.contour.buff;
    buff.allocate(points, (points - 1) * 2);
    for (let i = 0; i < points - 1; i++) {
      let p = this.points.get(i);
      buff.writePos(i, p[0], this.z / ZSCALE, p[1]);
      buff.writeLine(i * 2, i, i + 1);
    }
    buff.writePos(points - 1, this.pointer[0], this.z / ZSCALE, this.pointer[1]);
    return this.contour;
  }
}

class DrawWall {
  private wallId = -1;
  private fromFloor = true;
  private points = new Deck<number[]>();

  public start(board: Board, hit: Hitscan) {
    this.points.clear();
    this.wallId = hit.id;
    let [type, z] = getClosestSectorZ(board, sectorOfWall(board, this.wallId), hit.x, hit.y, hit.z);
    this.fromFloor = type == SubType.FLOOR;
    this.points.push([hit.x, hit.y, z]);
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
export let DRAW_SECTOR = new DrawSector();

export function snap(board: Board, hit: Hitscan, context: Context): [number, number] {
  let w = getClosestWall(board, hit);
  if (w != -1) {
    let wall = board.walls[w];
    return [wall.x, wall.y];
  } else if (isSector(hit.type)) {
    let x = context.snap(hit.x);
    let y = context.snap(hit.y);
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
    let t = context.snap(dt * repeat) / repeat;
    let x = int(wall.x + (t * dx));
    let y = int(wall.y + (t * dy));
    return [x, y];
  }
}

function getClosestWall(board: Board, hit: Hitscan): number {
  if (isWall(hit.type))
    return closestWallInSector(board, sectorOfWall(board, hit.id), hit.x, hit.y, 128);
  else if (isSector(hit.type))
    return closestWallInSector(board, hit.id, hit.x, hit.y, 128);
  return -1;
}

function getClosestSectorZ(board: Board, sectorId: number, x: number, y: number, z: number): [SubType, number] {
  let sector = board.sectors[sectorId];
  let fz = slope(board, sectorId, x, y, sector.floorheinum) + sector.floorz;
  let cz = slope(board, sectorId, x, y, sector.ceilingheinum) + sector.ceilingz;
  return Math.abs(z - fz) < Math.abs(z - cz) ? [SubType.FLOOR, fz] : [SubType.CEILING, cz];
}

function getAttachedSector(board: Board, hit: Hitscan): MessageHandler {
  let wall = board.walls[hit.id];
  let sectorId = wall.nextsector == -1 ? sectorOfWall(board, hit.id) : wall.nextsector;
  let type = getClosestSectorZ(board, sectorId, hit.x, hit.y, hit.z)[0];
  return SectorEnt.create(sectorId, type);
}

let list = new Deck<MessageHandler>();
let segment = new Deck<number>();
export function getFromHitscan(board: Board, hit: Hitscan): Deck<MessageHandler> {
  list.clear();
  let w = getClosestWall(board, hit);
  if (w != -1) {
    list.push(WallEnt.create(board, w));
    list.push(getAttachedSector(board, hit))
  } else if (isWall(hit.type)) {
    let w1 = nextwall(board, hit.id);
    segment.clear().push(hit.id).push(w1);
    list.push(WallSegmentsEnt.create(board, segment));
    list.push(getAttachedSector(board, hit))
  } else if (isSector(hit.type)) {
    list.push(SectorEnt.create(hit.id, hit.type));
  } else if (isSprite(hit.type)) {
    list.push(SpriteEnt.create(hit.id));
  }
  return list;
}
