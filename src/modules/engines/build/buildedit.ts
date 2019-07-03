import { len2d } from "../../../libs/mathutils";
import * as GLM from "../../../libs_js/glmatrix";
import { Deck } from "../../deck";
import * as BU from "./boardutils";
import { ArtProvider } from "./gl/cache";
import { Message, MessageHandler, MessageHandlerFactory } from "./messages";
import { Board } from "./structs";
import { Hitscan, HitType, isSector, isSprite, isWall, sectorOfWall, sectorZ, ZSCALE } from "./utils";

class MovingHandle {
  private startPoint = GLM.vec3.create();
  private currentPoint = GLM.vec3.create();
  private dzoff = 0;
  private active = false;
  private parallel = false;
  public elevate = false;
  public snappedSector = -1;
  public snappedSectorZ = 0;

  public start(x: number, y: number, z: number) {
    GLM.vec3.set(this.startPoint, x, y, z);
    GLM.vec3.set(this.currentPoint, x, y, z);
    this.dzoff = 0;
    this.active = true;
  }

  public update(s: GLM.Vec3Array, v: GLM.Vec3Array, elevate: boolean, parallel: boolean, hit: Hitscan, board: Board) {
    this.parallel = parallel;
    this.elevate = elevate;
    if (elevate) {
      if (isSector(hit.type)) {
        this.snappedSector = hit.id;
        this.snappedSectorZ = sectorZ(board, hit.id, hit.type) / ZSCALE;
      } else {
        this.snappedSector = -1;
      }
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
  invalidateAll(): void;
  highlightSector(gl: WebGLRenderingContext, board: Board, sectorId: number): void;
  highlightWall(gl: WebGLRenderingContext, board: Board, wallId: number, sectorId: number): void;
  highlightSprite(gl: WebGLRenderingContext, board: Board, spriteId: number): void;
  highlight(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: HitType): void;
}

class StartMove implements Message { }
class Move extends MovingHandle implements Message { }
class EndMove implements Message { }
class Highlight implements Message { }
class SplitWall implements Message { x: number; y: number; wallId: number; }

export let START_MOVE = new StartMove();
export let MOVE = new Move();
export let END_MOVE = new EndMove();
export let HIGHLIGHT = new Highlight();
export let SPLIT_WALL = new SplitWall();

class WallEnt { constructor(public wallId: number, public origin = GLM.vec2.create(), public active = false) { } }
class SpriteEnt { constructor(public spriteId: number, public origin = GLM.vec3.create()) { } }
class SectorEnt { constructor(public sectorId: number, public type: HitType, public originz = 0) { } }

let connectedWalls = new Deck<number>();
let wallHandlerFactory = new MessageHandlerFactory<WallEnt>()
  .register(StartMove, (obj: WallEnt, msg: StartMove, ctx: BuildContext) => {
    let wall = ctx.board.walls[obj.wallId];
    GLM.vec2.set(obj.origin, wall.x, wall.y);
    obj.active = true;
  })
  .register(Move, (obj: WallEnt, msg: Move, ctx: BuildContext) => {
    let x = ctx.snap(obj.origin[0] + msg.dx());
    let y = ctx.snap(obj.origin[1] + msg.dy());
    if (BU.moveWall(ctx.board, obj.wallId, x, y))
      ctx.invalidateAll();
  })
  .register(EndMove, (obj: WallEnt, msg: EndMove, ctx: BuildContext) => {
    obj.active = false;
  })
  .register(Highlight, (obj: WallEnt, msg: Highlight, ctx: BuildContext) => {
    if (obj.active) {
      BU.connectedWalls(ctx.board, obj.wallId, connectedWalls.clear());
      for (let i = 0; i < connectedWalls.length(); i++) {
        let w = connectedWalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, w, s);
        let p = BU.prevwall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, p, s);
        ctx.highlightSector(ctx.gl, ctx.board, s);
      }
    } else {
      let s = sectorOfWall(ctx.board, obj.wallId);
      ctx.highlightWall(ctx.gl, ctx.board, obj.wallId, s);
    }
  })
  .register(SplitWall, (obj: WallEnt, msg: SplitWall, ctx: BuildContext) => {
    if (obj.wallId != msg.wallId)
      return;
    BU.splitWall(ctx.board, obj.wallId, msg.x, msg.y, ctx.art, []);
    ctx.invalidateAll();
  });

let spriteHandlerFactory = new MessageHandlerFactory<SpriteEnt>()
  .register(StartMove, (obj: SpriteEnt, msg: StartMove, ctx: BuildContext) => {
    let spr = ctx.board.sprites[obj.spriteId];
    GLM.vec3.set(obj.origin, spr.x, spr.z / ZSCALE, spr.y);
  })
  .register(Move, (obj: SpriteEnt, msg: Move, ctx: BuildContext) => {
    let x = ctx.snap(obj.origin[0] + msg.dx());
    let y = ctx.snap(obj.origin[2] + msg.dy());
    let z = ctx.snap(obj.origin[1] + msg.dz()) * ZSCALE;
    if (BU.moveSprite(ctx.board, obj.spriteId, x, y, z)) {
      ctx.invalidateAll();
    }
  })
  .register(Highlight, (obj: SpriteEnt, msg: Highlight, ctx: BuildContext) => {
    ctx.highlightSprite(ctx.gl, ctx.board, obj.spriteId);
  });

function setSectorZ(board: Board, sectorId: number, type: HitType, z: number): boolean {
  let pz = sectorZ(board, sectorId, type);
  if (pz == z)
    return false;
  let sec = board.sectors[sectorId];
  if (type == HitType.CEILING) sec.ceilingz = z; else sec.floorz = z;
  return true;
}

let sectorHandlerFactory = new MessageHandlerFactory<SectorEnt>()
  .register(StartMove, (obj: SectorEnt, msg: StartMove, ctx: BuildContext) => {
    obj.originz = sectorZ(ctx.board, obj.sectorId, obj.type) / ZSCALE;
  })
  .register(Move, (obj: SectorEnt, msg: Move, ctx: BuildContext) => {
    if (!msg.elevate)
      return;
    let useSectorElevation = msg.snappedSector != obj.sectorId && msg.snappedSector != -1;
    let z = (useSectorElevation ? msg.snappedSectorZ : ctx.snap(obj.originz + msg.dz())) * ZSCALE;
    if (setSectorZ(ctx.board, obj.sectorId, obj.type, z)) {
      ctx.invalidateAll();
    }
  })
  .register(Highlight, (obj: SectorEnt, msg: Highlight, ctx: BuildContext) => {
    ctx.highlight(ctx.gl, ctx.board, obj.sectorId, -1, obj.type);
  });

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
    list.push(wallHandlerFactory.handler(new WallEnt(w)));
  } else if (isWall(hit.type)) {
    let w1 = BU.nextwall(board, hit.id);
    list.push(wallHandlerFactory.handler(new WallEnt(hit.id)));
    list.push(wallHandlerFactory.handler(new WallEnt(w1)));
  } else if (isSector(hit.type)) {
    list.push(sectorHandlerFactory.handler(new SectorEnt(hit.id, hit.type)));
  } else if (isSprite(hit.type)) {
    list.push(spriteHandlerFactory.handler(new SpriteEnt(hit.id)));
  }
  return list;
}
