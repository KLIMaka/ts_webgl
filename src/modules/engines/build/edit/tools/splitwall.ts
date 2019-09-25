import { splitWall } from "../../boardutils";
import { sectorOfWall } from "../../utils";
import { invalidateSectorAndWalls, snap } from "../editutils";
import { BuildContext } from "../../api";
import { MessageHandlerIml } from "../../messages";
import { HitScan, Input } from "../editapi";
import { isWall } from "../../hitscan";

export class SplitWall extends MessageHandlerIml {
  private x = 0;
  private y = 0;
  private wallId = -1;
  private active = false;

  private update(x: number, y: number, wallId: number) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.wallId = wallId;
  }

  private run(ctx: BuildContext) {
    if (!this.active)
      return;
    splitWall(ctx.board, this.wallId, this.x, this.y, ctx.art, []);
    let s = sectorOfWall(ctx.board, this.wallId);
    invalidateSectorAndWalls(s, ctx);
  }

  public HitScan(msg: HitScan, ctx: BuildContext) {
    this.active = false;
    if (msg.hit.t != -1) {
      let [x, y] = snap(msg.hit, ctx);
      if (isWall(msg.hit.type)) this.update(x, y, msg.hit.id);
    }
  }

  public Input(msg: Input, ctx: BuildContext) {
    if (msg.state.keys['CTRL'] && msg.state.mouseClicks[0]) this.run(ctx);
  }
}
