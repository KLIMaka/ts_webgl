import { StringEvent } from "../../../../keymap";
import { BuildContext } from "../../api";
import { splitWall } from "../../boardutils";
import { MessageHandlerReflective } from "../../handlerapi";
import { isWall } from "../../hitscan";
import { sectorOfWall } from "../../utils";
import { invalidateSectorAndWalls, snap } from "../editutils";
import { EventBus, HitScan } from "../messages";

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

  public EventBus(msg: EventBus, ctx: BuildContext) {
    let events = msg.events;
    for (let i = events.first(); i != -1; i = events.next(i)) {
      let e = events.get(i);
      if (!(e instanceof StringEvent)) return;
      if (e.name == 'split_wall') {
        this.run(ctx);
        events.consume(i);
      }
    }
  }
}
