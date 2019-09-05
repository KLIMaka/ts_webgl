import { moveSprite } from "../boardutils";
import { MessageHandlerFactory } from "../messages";
import { ZSCALE } from "../utils";
import * as GLM from "../../../../libs_js/glmatrix";
import { StartMove, BuildContext, Move, Highlight } from "./editapi";

export class SpriteEnt {
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
    }
    else {
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
