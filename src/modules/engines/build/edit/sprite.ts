import { cyclic, tuple } from "../../../../libs/mathutils";
import * as GLM from "../../../../libs_js/glmatrix";
import { moveSprite, insertSprite } from "../boardutils";
import { MessageHandlerIml } from "../messages";
import { ZSCALE } from "../utils";
import { Flip, Highlight, Move, Palette, PanRepeat, SetPicnum, Shade, SpriteMode, StartMove } from "./editapi";
import { BuildContext } from "../api";

export class SpriteEnt extends MessageHandlerIml {

  public static create(id: number) {
    return new SpriteEnt(id);
  }

  constructor(
    public spriteId: number,
    public origin = GLM.vec3.create(),
    public origAng = 0) { super() }

  public StartMove(msg: StartMove, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    if (msg.handle.mod3) this.spriteId = insertSprite(ctx.board, spr.x, spr.y, spr.z, spr);
    GLM.vec3.set(this.origin, spr.x, spr.z / ZSCALE, spr.y);
    this.origAng = spr.ang;
  }

  public Move(msg: Move, ctx: BuildContext) {
    if (msg.handle.mod1) {
      let spr = ctx.board.sprites[this.spriteId];
      spr.ang = ctx.snap(this.origAng + msg.handle.dz());
      ctx.invalidator.invalidateSprite(this.spriteId);
    } else {
      let x = ctx.snap(this.origin[0] + msg.handle.dx());
      let y = ctx.snap(this.origin[2] + msg.handle.dy());
      let z = ctx.snap(this.origin[1] + msg.handle.dz()) * ZSCALE;
      if (moveSprite(ctx.board, this.spriteId, x, y, z)) {
        ctx.invalidator.invalidateSprite(this.spriteId);
      }
    }
  }

  public Highlight(msg: Highlight, ctx: BuildContext) {
    msg.set.add(tuple(4, this.spriteId));
  }

  public SetPicnum(msg: SetPicnum, ctx: BuildContext) {
    let sprite = ctx.board.sprites[this.spriteId];
    sprite.picnum = msg.picnum;
    ctx.invalidator.invalidateSprite(this.spriteId);
  }

  public Shade(msg: Shade, ctx: BuildContext) {
    let sprite = ctx.board.sprites[this.spriteId];
    let shade = sprite.shade;
    if (msg.absolute && shade == msg.value) return;
    if (msg.absolute) sprite.shade = msg.value; else sprite.shade += msg.value;
    ctx.invalidator.invalidateSprite(this.spriteId);
  }

  public PanRepeat(msg: PanRepeat, ctx: BuildContext) {
    let sprite = ctx.board.sprites[this.spriteId];
    if (msg.absolute) {
      if (sprite.xoffset == msg.xpan && sprite.yoffset == msg.ypan && sprite.xrepeat == msg.xrepeat && sprite.yrepeat == msg.yrepeat) return;
      sprite.xoffset = msg.xpan;
      sprite.yoffset = msg.ypan;
      sprite.xrepeat = msg.xrepeat;
      sprite.yrepeat = msg.yrepeat;
    } else {
      sprite.xoffset += msg.xpan;
      sprite.yoffset += msg.ypan;
      sprite.xrepeat += msg.xrepeat;
      sprite.yrepeat += msg.yrepeat;
    }
    ctx.invalidator.invalidateSprite(this.spriteId);
  }

  public Palette(msg: Palette, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    if (msg.absolute) {
      if (msg.value == spr.pal) return;
      spr.pal = msg.value;
    } else {
      spr.pal = cyclic(spr.pal + msg.value, msg.max);
    }
    ctx.invalidator.invalidateSprite(this.spriteId);
  }

  public SpriteMode(msg: SpriteMode, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    spr.cstat.type = cyclic(spr.cstat.type + 1, 3);
    ctx.invalidator.invalidateSprite(this.spriteId);
  }

  public Flip(msg: Flip, ctx: BuildContext) {
    let spr = ctx.board.sprites[this.spriteId];
    let flip = spr.cstat.xflip + spr.cstat.yflip * 2;
    let nflip = cyclic(flip + 1, 4);
    spr.cstat.xflip = nflip & 1;
    spr.cstat.yflip = (nflip & 2) >> 1;
    ctx.invalidator.invalidateSprite(this.spriteId);
  }
}
