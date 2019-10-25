import { BuildContext } from "../../api";
import { splitWall } from "../../boardutils";
import { MessageHandlerReflective } from "../../handlerapi";
import { Hitscan, isWall } from "../../hitscan";
import { sectorOfWall } from "../../utils";
import { invalidateSectorAndWalls, snap } from "../editutils";
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
    splitWall(ctx.board, this.wallId, this.x, this.y, ctx.art, []);
    let s = sectorOfWall(ctx.board, this.wallId);
    invalidateSectorAndWalls(s, ctx);
    let nextsector = ctx.board.walls[this.wallId].nextsector;
    if (nextsector != -1) {
      invalidateSectorAndWalls(nextsector, ctx);
    }
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    this.active = false;
    let hit = ctx.state.get<Hitscan>('hitscan');
    if (hit.t != -1) {
      let [x, y, id, type] = snap(ctx);
      if (isWall(type)) this.update(x, y, id);
    }
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    if (msg.name == 'split_wall') this, this.run(ctx);
  }
}
