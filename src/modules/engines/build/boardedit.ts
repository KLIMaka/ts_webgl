import { len2d } from "../../../libs/mathutils";
import * as GLM from "../../../libs_js/glmatrix";
import { Deck, IndexedDeck, Collection } from "../../deck";
import { closestWallInSector, connectedWalls, moveSprite, moveWall, nextwall, prevwall, splitWall } from "./boardutils";
import { ArtProvider } from "./gl/cache";
import { Hitscan, isSector, isSprite, isWall, SubType } from "./hitscan";
import { Message, MessageHandler, MessageHandlerFactory } from "./messages";
import { Board } from "./structs";
import { createSlopeCalculator, heinumCalc, sectorOfWall, sectorZ, setSectorHeinum, setSectorZ, ZSCALE } from "./utils";
import { List } from "../../../libs/list";

class MovingHandle {
  private startPoint = GLM.vec3.create();
  private currentPoint = GLM.vec3.create();
  private dzoff = 0;
  private active = false;
  public parallel = false;
  public elevate = false;
  public hit: Hitscan;

  public start(hit: Hitscan) {
    this.hit = hit;
    GLM.vec3.set(this.startPoint, hit.x, hit.z / ZSCALE, hit.y);
    GLM.vec3.copy(this.currentPoint, this.startPoint);
    this.dzoff = 0;
    this.active = true;
  }

  public update(s: GLM.Vec3Array, v: GLM.Vec3Array, elevate: boolean, parallel: boolean, hit: Hitscan, board: Board) {
    this.parallel = parallel;
    this.elevate = elevate;
    this.hit = hit;
    if (elevate) {
      let dx = this.currentPoint[0] - s[0];
      let dy = this.currentPoint[2] - s[2];
      let t = len2d(dx, dy) / len2d(v[0], v[2]);
      this.dzoff = v[1] * t + s[1] - this.currentPoint[1];
    } else {
      this.dzoff = 0;
      let dz = this.startPoint[1] - s[1];
      let t = dz / v[1];
      GLM.vec3.copy(this.currentPoint, v);
      GLM.vec3.scale(this.currentPoint, this.currentPoint, t);
      GLM.vec3.add(this.currentPoint, this.currentPoint, s);
    }
  }

  public isActive() { return this.active; }
  public stop() { this.active = false; }
  public dx() { return this.parallel && Math.abs(this.dx_()) < Math.abs(this.dy_()) ? 0 : this.dx_(); }
  public dy() { return this.parallel && Math.abs(this.dy_()) < Math.abs(this.dx_()) ? 0 : this.dy_(); }
  public dz() { return this.elevate ? this.currentPoint[1] - this.startPoint[1] + this.dzoff : 0; }

  private dx_() { return this.currentPoint[0] - this.startPoint[0] }
  private dy_() { return this.currentPoint[2] - this.startPoint[2] }
}

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
  highlightWall(gl: WebGLRenderingContext, board: Board, wallId: number, sectorId: number): void;
  highlightSprite(gl: WebGLRenderingContext, board: Board, spriteId: number): void;
  highlight(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: SubType): void;
}

class StartMove implements Message { constructor(public handle: MovingHandle) { } }
class Move implements Message { constructor(public handle: MovingHandle) { } }
class EndMove implements Message { constructor(public handle: MovingHandle) { } }
class Highlight implements Message { }
class SplitWall implements Message { x: number; y: number; wallId: number; }

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

function invalidateSector(sectorId: number, ctx: BuildContext) {
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

class WallSegmentsEnt {
  private static invalidatedSectors = new IndexedDeck<number>();

  private static factory = new MessageHandlerFactory()
    .register(StartMove, (obj: WallSegmentsEnt, msg: StartMove, ctx: BuildContext) => obj.startMove(msg, ctx))
    .register(Move, (obj: WallSegmentsEnt, msg: Move, ctx: BuildContext) => obj.move(msg, ctx))
    .register(EndMove, (obj: WallSegmentsEnt, msg: EndMove, ctx: BuildContext) => obj.endMove(msg, ctx))
    .register(Highlight, (obj: WallSegmentsEnt, msg: Highlight, ctx: BuildContext) => obj.highlight(msg, ctx))
    .register(SplitWall, (obj: WallSegmentsEnt, msg: SplitWall, ctx: BuildContext) => obj.split(msg, ctx));

  public static create(ids: Collection<number>) {
    return WallSegmentsEnt.factory.handler(new WallSegmentsEnt(ids));
  }

  constructor(
    public wallIds: Collection<number>,
    public origin = GLM.vec2.create(),
    public refwall = -1,
    public active = false,
    public highlighted = new Deck<number>(),
    public connectedWalls = new IndexedDeck<number>()
  ) { }

  private invalidate(ctx: BuildContext) {
    let invalidatedSectors = WallSegmentsEnt.invalidatedSectors.clear();
    let cwalls = WallSegmentsEnt.connectedWalls(ctx.board, this.wallIds, this.connectedWalls);
    for (let i = 0; i < this.wallIds.length(); i++) {
      let w = this.wallIds.get(i);
      connectedWalls(ctx.board, w, cwalls);
    }

    for (let i = 0; i < cwalls.length(); i++) {
      let w = cwalls.get(i);
      let s = sectorOfWall(ctx.board, w);
      if (invalidatedSectors.indexOf(s) == -1) {
        invalidateSector(s, ctx);
        invalidatedSectors.push(s);
      }
    }
  }

  private static highlightedWalls(board: Board, walls: Collection<number>, result: Deck<number>): Collection<number> {
    if (result.length() != 0) return result;
    let chains = new Deck<List<number>>();
    for (let i = 0; i < walls.length(); i++) {
      let w = walls.get(i);
      let partOfOldChain = false;
      for (let c = 0; c < chains.length(); c++) {
        let chain = chains.get(c);
        if (nextwall(board, w) == chain.first().obj) {
          chain.insertBefore(w);
          partOfOldChain = true;
          break;
        } else if (prevwall(board, w) == chain.last().obj) {
          chain.insertAfter(w);
          partOfOldChain = true;
          break;
        }
      }
      if (!partOfOldChain) {
        let l = new List<number>();
        l.push(w);
        chains.push(l);
      }
    }
    for (let c = 0; c < chains.length(); c++) {
      let chain = chains.get(c);
      if (chain.first().next != chain.terminator())
        chain.pop();
      for (let node = chain.first(); node != chain.terminator(); node = node.next) {
        result.push(node.obj);
      }
    }
    return result;
  }

  private static connectedWalls(board: Board, walls: Collection<number>, result: IndexedDeck<number>) {
    if (result.length() != 0) return result;
    for (let i = 0; i < walls.length(); i++) {
      let w = walls.get(i);
      connectedWalls(board, w, result);
    }
    return result;
  }

  public startMove(msg: StartMove, ctx: BuildContext) {
    this.refwall = getClosestWallByIds(ctx.board, msg.handle.hit, this.wallIds);
    let wall = ctx.board.walls[this.refwall];
    GLM.vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  public move(msg: Move, ctx: BuildContext) {
    let x = ctx.snap(this.origin[0] + msg.handle.dx());
    let y = ctx.snap(this.origin[1] + msg.handle.dy());
    let wall = ctx.board.walls[this.refwall];
    let dx = x - this.origin[0];
    let dy = y - this.origin[1];
    if (moveWall(ctx.board, this.refwall, x, y)) {
      for (let i = 0; i < this.wallIds.length(); i++) {
        let w = this.wallIds.get(i);
        let wall = ctx.board.walls[w];
        moveWall(ctx.board, w, wall.x + dx, wall.y + dy);
      }
      this.invalidate(ctx);
    }
  }

  public endMove(msg: EndMove, ctx: BuildContext) {
    this.active = false;
  }

  public highlight(msg: Highlight, ctx: BuildContext) {
    if (this.active) {
      let cwalls = WallSegmentsEnt.connectedWalls(ctx.board, this.wallIds, this.connectedWalls);
      for (let i = 0; i < cwalls.length(); i++) {
        let w = cwalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, w, s);
        let p = prevwall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, p, s);
        ctx.highlightSector(ctx.gl, ctx.board, s);
      }
    } else {
      let hwalls = WallSegmentsEnt.highlightedWalls(ctx.board, this.wallIds, this.highlighted);
      for (let i = 0; i < hwalls.length(); i++) {
        let w = hwalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, w, s);
      }
    }
  }

  public split(msg: SplitWall, ctx: BuildContext) {
    //   if (this.wallId != msg.wallId) return;
    //   splitWall(ctx.board, this.wallId, msg.x, msg.y, ctx.art, []);
    //   let s = sectorOfWall(ctx.board, this.wallId);
    //   invalidateSector(s, ctx);
  }
}

class WallEnt {
  private static connectedWalls = new Deck<number>();
  private static invalidatedSectors = new IndexedDeck<number>();
  private static factory = new MessageHandlerFactory()
    .register(StartMove, (obj: WallEnt, msg: StartMove, ctx: BuildContext) => obj.startMove(msg, ctx))
    .register(Move, (obj: WallEnt, msg: Move, ctx: BuildContext) => obj.move(msg, ctx))
    .register(EndMove, (obj: WallEnt, msg: EndMove, ctx: BuildContext) => obj.endMove(msg, ctx))
    .register(Highlight, (obj: WallEnt, msg: Highlight, ctx: BuildContext) => obj.highlight(msg, ctx));

  public static create(id: number) {
    return WallEnt.factory.handler(new WallEnt(id));
  }

  constructor(
    public wallId: number,
    public origin = GLM.vec2.create(),
    public originZ = 0,
    public zMotionSector = -1,
    public zMotionType: SubType = SubType.CEILING,
    public active = false) { }

  public startMove(msg: StartMove, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    GLM.vec2.set(this.origin, wall.x, wall.y);

    let hit = msg.handle.hit;
    this.zMotionSector = wall.nextsector == -1 ? sectorOfWall(ctx.board, this.wallId) : wall.nextsector;
    let sec = ctx.board.sectors[this.zMotionSector];
    let slope = createSlopeCalculator(sec, ctx.board.walls);
    let floorz = slope(hit.x, hit.y, sec.floorheinum) + sec.floorz;
    let ceilz = slope(hit.x, hit.y, sec.ceilingheinum) + sec.ceilingz;
    this.zMotionType = Math.abs(hit.z - floorz) < Math.abs(hit.z - ceilz) ? SubType.FLOOR : SubType.CEILING;
    this.originZ = sectorZ(ctx.board, this.zMotionSector, this.zMotionType) / ZSCALE;
    this.active = true;
  }

  private invalidate(ctx: BuildContext) {
    WallEnt.invalidatedSectors.clear();
    connectedWalls(ctx.board, this.wallId, WallEnt.connectedWalls.clear());
    for (let i = 0; i < WallEnt.connectedWalls.length(); i++) {
      let w = WallEnt.connectedWalls.get(i);
      let s = sectorOfWall(ctx.board, w);
      if (WallEnt.invalidatedSectors.indexOf(s) == -1) {
        invalidateSector(s, ctx);
        WallEnt.invalidatedSectors.push(s);
      }
    }
  }

  public move(msg: Move, ctx: BuildContext) {
    if (msg.handle.elevate) {
      if (msg.handle.parallel) {
        let x = this.origin[0];
        let y = this.origin[1];
        let z = ctx.snap(this.originZ + msg.handle.dz()) * ZSCALE;
        let h = heinumCalc(ctx.board, this.zMotionSector, x, y, z);
        if (setSectorHeinum(ctx.board, this.zMotionSector, this.zMotionType, h))
          this.invalidate(ctx);
      } else {
        let z = ctx.snap(this.originZ + msg.handle.dz()) * ZSCALE;
        if (setSectorZ(ctx.board, this.zMotionSector, this.zMotionType, z))
          this.invalidate(ctx);
      }
    } else {
      let x = ctx.snap(this.origin[0] + msg.handle.dx());
      let y = ctx.snap(this.origin[1] + msg.handle.dy());
      if (moveWall(ctx.board, this.wallId, x, y)) {
        this.invalidate(ctx);
      }
    }
  }

  public endMove(msg: EndMove, ctx: BuildContext) {
    this.active = false;
  }

  public highlight(msg: Highlight, ctx: BuildContext) {
    if (this.active) {
      connectedWalls(ctx.board, this.wallId, WallEnt.connectedWalls.clear());
      for (let i = 0; i < WallEnt.connectedWalls.length(); i++) {
        let w = WallEnt.connectedWalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, w, s);
        let p = prevwall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, p, s);
        ctx.highlightSector(ctx.gl, ctx.board, s);
      }
    } else {
      let s = sectorOfWall(ctx.board, this.wallId);
      ctx.highlightWall(ctx.gl, ctx.board, this.wallId, s);
    }
  }
}


class SpriteEnt {
  private static factory = new MessageHandlerFactory()
    .register(StartMove, (obj: SpriteEnt, msg: StartMove, ctx: BuildContext) => obj.startMove(msg, ctx))
    .register(Move, (obj: SpriteEnt, msg: Move, ctx: BuildContext) => obj.move(msg, ctx))
    .register(Highlight, (obj: SpriteEnt, msg: Highlight, ctx: BuildContext) => obj.highlight(msg, ctx));

  public static create(id: number) {
    return SpriteEnt.factory.handler(new SpriteEnt(id));
  }

  constructor(
    public spriteId: number,
    public origin = GLM.vec3.create(),
    public origAng = 0) { }

  public startMove(msg: StartMove, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    GLM.vec3.set(this.origin, spr.x, spr.z / ZSCALE, spr.y);
    this.origAng = spr.ang;
  }

  public move(msg: Move, ctx: BuildContext) {
    if (msg.handle.parallel) {
      let spr = ctx.board.sprites[this.spriteId];
      spr.ang = ctx.snap(this.origAng + msg.handle.dz());
      ctx.invalidateSprite(this.spriteId);
    } else {
      let x = ctx.snap(this.origin[0] + msg.handle.dx());
      let y = ctx.snap(this.origin[2] + msg.handle.dy());
      let z = ctx.snap(this.origin[1] + msg.handle.dz()) * ZSCALE;
      if (moveSprite(ctx.board, this.spriteId, x, y, z)) {
        ctx.invalidateSprite(this.spriteId);
      }
    }
  }

  public highlight(msg: Highlight, ctx: BuildContext) {
    ctx.highlightSprite(ctx.gl, ctx.board, this.spriteId);
  }
}


class SectorEnt {
  private static factory = new MessageHandlerFactory()
    .register(StartMove, (obj: SectorEnt, msg: StartMove, ctx: BuildContext) => obj.startMove(msg, ctx))
    .register(Move, (obj: SectorEnt, msg: Move, ctx: BuildContext) => obj.move(msg, ctx))
    .register(Highlight, (obj: SectorEnt, msg: Highlight, ctx: BuildContext) => obj.highlight(msg, ctx));

  public static create(id: number, type: SubType) {
    return SectorEnt.factory.handler(new SectorEnt(id, type));
  }

  constructor(
    public sectorId: number,
    public type: SubType,
    public originz = 0,
    public origin = GLM.vec2.create()) { }

  public startMove(msg: StartMove, ctx: BuildContext) {
    let x = msg.handle.hit.x;
    let y = msg.handle.hit.y;
    // let sec = ctx.board.sectors[this.sectorId];
    // let slope = createSlopeCalculator(sec, ctx.board.walls);
    // this.originz = slope(x, y, this.type == HitType.CEILING ? sec.ceilingheinum : sec.floorheinum) + sectorZ(ctx.board, this.sectorId, this.type)) / ZSCALE;
    this.originz = sectorZ(ctx.board, this.sectorId, this.type) / ZSCALE;
    GLM.vec2.set(this.origin, x, y);
  };

  public move(msg: Move, ctx: BuildContext) {
    if (!msg.handle.elevate)
      return;

    if (msg.handle.parallel) {
      let x = this.origin[0];
      let y = this.origin[1];
      let z = ctx.scaledSnap(this.originz + msg.handle.dz() * ZSCALE, 1);
      let h = heinumCalc(ctx.board, this.sectorId, x, y, z);
      if (setSectorHeinum(ctx.board, this.sectorId, this.type, h)) {
        invalidateSector(this.sectorId, ctx);
      }
    } else {
      let z = isSector(msg.handle.hit.type) && msg.handle.hit.id != this.sectorId
        ? sectorZ(ctx.board, msg.handle.hit.id, msg.handle.hit.type) / ZSCALE
        : ctx.snap(this.originz + msg.handle.dz())
      if (setSectorZ(ctx.board, this.sectorId, this.type, z * ZSCALE)) {
        invalidateSector(this.sectorId, ctx);
      }
    }
  }

  public highlight(msg: Highlight, ctx: BuildContext) {
    ctx.highlight(ctx.gl, ctx.board, this.sectorId, -1, this.type);
  }
}

function getClosestWallByIds(board: Board, hit: Hitscan, ids: Collection<number>): number {
  if (ids.length() == 1)
    return ids.get(0);
  let id = -1;
  let mindist = Number.MAX_VALUE;
  for (let i = 0; i < ids.length(); i++) {
    let w = ids.get(i);
    let wall = board.walls[w];
    let dist = len2d(wall.x - hit.x, wall.y - hit.y);
    if (dist < mindist) {
      id = w;
      mindist = dist;
    }
  }
  return id;
}

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
