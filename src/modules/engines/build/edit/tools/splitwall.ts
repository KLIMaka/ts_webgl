import { BuildContext } from "../../api";
import { splitWall } from "../../boardutils";
import { MessageHandlerReflective } from "../../handlerapi";
import { sectorOfWall } from "../../utils";
import { invalidateSectorAndWalls } from "../editutils";
import { Frame, NamedMessage } from "../messages";

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
    splitWall(ctx.board, this.wallId, this.x, this.y, ctx.art);
    ctx.commit();
    let s = sectorOfWall(ctx.board, this.wallId);
    invalidateSectorAndWalls(s, ctx);
    let nextsector = ctx.board.walls[this.wallId].nextsector;
    if (nextsector != -1) {
      invalidateSectorAndWalls(nextsector, ctx);
    }
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    this.active = false;
    const target = ctx.view.snapTarget();
    if (target.entity != null) {
      const [x, y] = target.coords;
      if (target.entity.isWall()) this.update(x, y, target.entity.id);
    }
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    if (msg.name == 'split_wall') this, this.run(ctx);
  }
}
