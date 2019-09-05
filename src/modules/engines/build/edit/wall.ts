import * as GLM from "../../../../libs_js/glmatrix";
import { Deck, IndexedDeck } from "../../../deck";
import { connectedWalls, moveWall, prevwall } from "../boardutils";
import { SubType } from "../hitscan";
import { MessageHandlerFactory } from "../messages";
import { Board } from "../structs";
import { createSlopeCalculator, heinumCalc, sectorOfWall, sectorZ, setSectorHeinum, setSectorZ, ZSCALE } from "../utils";
import { BuildContext, EndMove, Highlight, invalidateSector, Move, StartMove } from "./boardedit";

function collectConnectedWalls(board: Board, wallId: number, result: Deck<number>) {
  if (result.length() != 0)
    return result;
  connectedWalls(board, wallId, result);
  return result;
}

export class WallEnt {
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
    public active = false,
    public connectedWalls = new Deck<number>()) { }

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
    let cwalls = collectConnectedWalls(ctx.board, this.wallId, this.connectedWalls);
    for (let i = 0; i < cwalls.length(); i++) {
      let w = cwalls.get(i);
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
      let cwalls = collectConnectedWalls(ctx.board, this.wallId, this.connectedWalls);
      for (let i = 0; i < cwalls.length(); i++) {
        let w = cwalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        ctx.highlightWallSegment(ctx.gl, ctx.board, w, s);
        let p = prevwall(ctx.board, w);
        ctx.highlightWallSegment(ctx.gl, ctx.board, p, s);
        ctx.highlightSector(ctx.gl, ctx.board, s);
      }
    } else {
      ctx.highlightWall(ctx.gl, ctx.board, this.wallId);
    }
  }
}
