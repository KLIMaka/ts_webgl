import { len2d } from "../../../libs/mathutils";
import * as GLM from "../../../libs_js/glmatrix";
import { Deck } from "../../deck";
import * as BU from "./boardutils";
import { ArtProvider } from "./gl/cache";
import { Message, MessageHandler, MessageHandlerFactory } from "./messages";
import { Board } from "./structs";
import { Hitscan, HitType, isSector, isSprite, isWall, sectorOfWall, sectorZ, ZSCALE, createSlopeCalculator, heinumCalc, sectorHeinum } from "./utils";

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
      GLM.vec3.set(this.currentPoint, v[0], v[1], v[2]);
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
  highlightSector(gl: WebGLRenderingContext, board: Board, sectorId: number): void;
  highlightWall(gl: WebGLRenderingContext, board: Board, wallId: number, sectorId: number): void;
  highlightSprite(gl: WebGLRenderingContext, board: Board, spriteId: number): void;
  highlight(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: HitType): void;
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

function setSectorZ(board: Board, sectorId: number, type: HitType, z: number): boolean {
  let pz = sectorZ(board, sectorId, type);
  if (pz == z)
    return false;
  let sec = board.sectors[sectorId];
  if (type == HitType.CEILING) sec.ceilingz = z; else sec.floorz = z;
  return true;
}

function setSectorHeinum(board: Board, sectorId: number, type: HitType, h: number): boolean {
  let ph = sectorHeinum(board, sectorId, type);
  if (ph == h)
    return false;
  let sec = board.sectors[sectorId];
  if (type == HitType.CEILING) sec.ceilingheinum = h; else sec.floorheinum = h;
  return true;
}

let handle = new MovingHandle();
export let MOVE = new Move(handle);
export let START_MOVE = new StartMove(handle);
export let END_MOVE = new EndMove(handle);
export let HIGHLIGHT = new Highlight();
export let SPLIT_WALL = new SplitWall();
export let DRAW_WALL = new DrawWall();

class WallEnt {
  private static connectedWalls = new Deck<number>();
  private static factory = new MessageHandlerFactory()
    .register(StartMove, (obj: WallEnt, msg: StartMove, ctx: BuildContext) => obj.startMove(msg, ctx))
    .register(Move, (obj: WallEnt, msg: Move, ctx: BuildContext) => obj.move(msg, ctx))
    .register(EndMove, (obj: WallEnt, msg: EndMove, ctx: BuildContext) => obj.endMove(msg, ctx))
    .register(Highlight, (obj: WallEnt, msg: Highlight, ctx: BuildContext) => obj.highlight(msg, ctx))
    .register(SplitWall, (obj: WallEnt, msg: SplitWall, ctx: BuildContext) => obj.split(msg, ctx));

  public static create(id: number) {
    return WallEnt.factory.handler(new WallEnt(id));
  }

  constructor(
    public wallId: number,
    public origin = GLM.vec2.create(),
    public originZ = 0,
    public zMotionSector = -1,
    public zMotionType: HitType = HitType.CEILING,
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
    this.zMotionType = Math.abs(hit.z - floorz) < Math.abs(hit.z - ceilz) ? HitType.FLOOR : HitType.CEILING;
    this.originZ = sectorZ(ctx.board, this.zMotionSector, this.zMotionType) / ZSCALE;
    this.active = true;
  }

  public move(msg: Move, ctx: BuildContext) {
    if (msg.handle.elevate) {
      if (msg.handle.parallel) {
        let x = this.origin[0];
        let y = this.origin[1];
        let z = ctx.snap(this.originZ + msg.handle.dz()) * ZSCALE;
        let h = heinumCalc(ctx.board, this.zMotionSector, x, y, z);
        if (setSectorHeinum(ctx.board, this.zMotionSector, this.zMotionType, h)) {
          ctx.invalidateAll();
        }
      } else {
        let z = ctx.snap(this.originZ + msg.handle.dz()) * ZSCALE;
        if (setSectorZ(ctx.board, this.zMotionSector, this.zMotionType, z))
          ctx.invalidateAll();
      }
    } else {
      let x = ctx.snap(this.origin[0] + msg.handle.dx());
      let y = ctx.snap(this.origin[1] + msg.handle.dy());
      if (BU.moveWall(ctx.board, this.wallId, x, y))
        ctx.invalidateAll();
    }
  }

  public endMove(msg: EndMove, ctx: BuildContext) {
    this.active = false;
  }

  public highlight(msg: Highlight, ctx: BuildContext) {
    if (this.active) {
      BU.connectedWalls(ctx.board, this.wallId, WallEnt.connectedWalls.clear());
      for (let i = 0; i < WallEnt.connectedWalls.length(); i++) {
        let w = WallEnt.connectedWalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, w, s);
        let p = BU.prevwall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, p, s);
        ctx.highlightSector(ctx.gl, ctx.board, s);
      }
    }
    else {
      let s = sectorOfWall(ctx.board, this.wallId);
      ctx.highlightWall(ctx.gl, ctx.board, this.wallId, s);
    }
  }

  public split(msg: SplitWall, ctx: BuildContext) {
    if (this.wallId != msg.wallId)
      return;
    BU.splitWall(ctx.board, this.wallId, msg.x, msg.y, ctx.art, []);
    ctx.invalidateAll();
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
    public origin = GLM.vec3.create()) { }

  public startMove(msg: StartMove, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    GLM.vec3.set(this.origin, spr.x, spr.z / ZSCALE, spr.y);
  }

  public move(msg: Move, ctx: BuildContext) {
    let x = ctx.snap(this.origin[0] + msg.handle.dx());
    let y = ctx.snap(this.origin[2] + msg.handle.dy());
    let z = ctx.snap(this.origin[1] + msg.handle.dz()) * ZSCALE;
    if (BU.moveSprite(ctx.board, this.spriteId, x, y, z)) {
      ctx.invalidateAll();
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

  public static create(id: number, type: HitType) {
    return SectorEnt.factory.handler(new SectorEnt(id, type));
  }

  constructor(
    public sectorId: number,
    public type: HitType,
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
        ctx.invalidateAll();
      }
    } else {
      let z = isSector(msg.handle.hit.type) && msg.handle.hit.id != this.sectorId
        ? sectorZ(ctx.board, msg.handle.hit.id, msg.handle.hit.type) / ZSCALE
        : ctx.snap(this.originz + msg.handle.dz())
      if (setSectorZ(ctx.board, this.sectorId, this.type, z * ZSCALE)) {
        ctx.invalidateAll();
      }
    }
  }

  public highlight(msg: Highlight, ctx: BuildContext) {
    ctx.highlight(ctx.gl, ctx.board, this.sectorId, -1, this.type);
  }
}

function getClosestWall(board: Board, hit: Hitscan): number {
  if (isWall(hit.type)) {
    return BU.closestWallInSector(board, sectorOfWall(board, hit.id), hit.x, hit.y, 64);
  } else if (isSector(hit.type)) {
    return BU.closestWallInSector(board, hit.id, hit.x, hit.y, 64);
  }
  return -1;
}

let list = new Deck<MessageHandler>();
export function getFromHitscan(board: Board, hit: Hitscan): Deck<MessageHandler> {
  list.clear();
  let w = getClosestWall(board, hit);
  if (w != -1) {
    list.push(WallEnt.create(w));
  } else if (isWall(hit.type)) {
    let w1 = BU.nextwall(board, hit.id);
    list.push(WallEnt.create(hit.id));
    list.push(WallEnt.create(w1));
  } else if (isSector(hit.type)) {
    list.push(SectorEnt.create(hit.id, hit.type));
  } else if (isSprite(hit.type)) {
    list.push(SpriteEnt.create(hit.id));
  }
  return list;
}
