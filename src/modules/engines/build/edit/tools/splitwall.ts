import { splitWall } from "../../boardutils";
import { sectorOfWall } from "../../utils";
import { invalidateSectorAndWalls, snap } from "../editutils";
import { BuildContext } from "../../api";
import { MessageHandlerReflective } from "../../handlerapi";
import { HitScan, Input } from "../messages";
import { isWall } from "../../hitscan";
import { action } from "../../../../keymap";

export class SplitWall extends MessageHandlerReflective {
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
    if (!this.active) return;
    splitWall(ctx.board, this.wallId, this.x, this.y, ctx.art, []);
    let s = sectorOfWall(ctx.board, this.wallId);
    invalidateSectorAndWalls(s, ctx);
    let nextsector = ctx.board.walls[this.wallId].nextsector;
    if (nextsector != -1) {
      invalidateSectorAndWalls(nextsector, ctx);
    }
  }

  public HitScan(msg: HitScan, ctx: BuildContext) {
    this.active = false;
    if (msg.hit.t != -1) {
      let [x, y, id, type] = snap(msg.hit, ctx);
      if (isWall(type)) this.update(x, y, id);
    }
  }

  public Input(msg: Input, ctx: BuildContext) {
    if (action('split_wall', msg.state)) this.run(ctx);
  }
}
