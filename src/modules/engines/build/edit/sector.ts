import { isSector, SubType } from "../hitscan";
import { MessageHandlerFactory } from "../messages";
import { heinumCalc, sectorZ, setSectorHeinum, setSectorZ, ZSCALE } from "../utils";
import * as GLM from "../../../../libs_js/glmatrix";
import { StartMove, Move, BuildContext, Highlight } from "./editapi";
import { invalidateSector } from "./boardedit";

export class SectorEnt {
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
    public origin = GLM.vec2.create()
  ) { }

  public startMove(msg: StartMove, ctx: BuildContext) {
    let x = msg.handle.hit.x;
    let y = msg.handle.hit.y;
    // let sec = ctx.board.sectors[this.sectorId];
    // let slope = createSlopeCalculator(sec, ctx.board.walls);
    // this.originz = slope(x, y, this.type == HitType.CEILING ? sec.ceilingheinum : sec.floorheinum) + sectorZ(ctx.board, this.sectorId, this.type)) / ZSCALE;
    this.originz = sectorZ(ctx.board, this.sectorId, this.type) / ZSCALE;
    GLM.vec2.set(this.origin, x, y);
  }

  public move(msg: Move, ctx: BuildContext) {
    if (!msg.handle.elevate)
      return;
    if (msg.handle.parallel) {
      let x = this.origin[0];
      let y = this.origin[1];
      let z = ctx.scaledSnap(this.originz + msg.handle.dz() * ZSCALE, 1);
      let h = heinumCalc(ctx.board, this.sectorId, x, y, z);
      if (setSectorHeinum(ctx.board, this.sectorId, this.type, h))
        invalidateSector(this.sectorId, ctx);
    } else {
      let z = isSector(msg.handle.hit.type) && msg.handle.hit.id != this.sectorId
        ? sectorZ(ctx.board, msg.handle.hit.id, msg.handle.hit.type) / ZSCALE
        : ctx.snap(this.originz + msg.handle.dz());
      if (setSectorZ(ctx.board, this.sectorId, this.type, z * ZSCALE))
        invalidateSector(this.sectorId, ctx);
    }
  }

  public highlight(msg: Highlight, ctx: BuildContext) {
    ctx.highlight(ctx.gl, ctx.board, this.sectorId, -1, this.type);
  }
}
