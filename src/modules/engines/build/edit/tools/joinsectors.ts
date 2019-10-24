import { action, StringEvent } from "../../../../keymap";
import { trace } from "../../../../logger";
import { BuildContext } from "../../api";
import { joinSectors } from "../../boardutils";
import { MessageHandlerReflective } from "../../handlerapi";
import { Hitscan } from "../../hitscan";
import { HitScan, EventBus } from "../messages";

export class JoinSectors extends MessageHandlerReflective {
  private sectorId1 = -1;
  private sectorId2 = -1;
  private hit: Hitscan;

  private join(hit: Hitscan, ctx: BuildContext) {
    if (this.sectorId1 == -1) {
      this.sectorId1 = hit.id;
    } else if (this.sectorId2 == -1) {
      this.sectorId2 = hit.id;
    }

    if (this.sectorId1 != -1 && this.sectorId2 != -1) {
      trace('joining ' + this.sectorId1 + ' and ' + this.sectorId2);
      let result = joinSectors(ctx.board, this.sectorId1, this.sectorId2);
      if (result == 0) ctx.invalidator.invalidateAll();
      this.sectorId1 = -1;
      this.sectorId2 = -1;
    }
  }

  public HitScan(msg: HitScan, ctx: BuildContext) {
    this.hit = msg.hit;
  }

  public EventBus(msg: EventBus, ctx: BuildContext) {
    let events = msg.events;
    for (let i = events.first(); i != -1; i = events.next(i)) {
      let e = events.get(i);
      if (!(e instanceof StringEvent)) return;
      if (e.name == 'join_sectors') {
        this.join(this.hit, ctx);
        events.consume(i);
      }
    }
  }
}