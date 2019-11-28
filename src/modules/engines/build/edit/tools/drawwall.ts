import { MessageHandlerReflective } from "../../handlerapi";
import { Frame, NamedMessage } from "../messages";
import { BuildContext } from "../../api";
import { Hitscan, isWall, EntityType } from "../../hitscan";

export class DrawWall extends MessageHandlerReflective {
  private activeWall = -1;

  private start(ctx: BuildContext) {
    let hit = ctx.hitscan;
    if (!hit.ent.isWall()) return;
    let wall = ctx.board.walls[hit.ent.id];
    if (wall.nextsector != -1 && hit.ent.type == EntityType.MID_WALL) return;
  }

  private insertPoint(ctx: BuildContext) {
    if (this.activeWall == -1) this.start(ctx);
  }

  private popPoint() {

  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'draw_point': this.insertPoint(ctx); return;
      case 'undo_draw_point': this.popPoint(); return;
    }
  }

  public Frame(msg: Frame, ctx: BuildContext) {

  }
}