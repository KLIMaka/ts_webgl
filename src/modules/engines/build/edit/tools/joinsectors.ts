import { trace } from "../../../../logger";
import { BuildContext } from "../../api";
import { joinSectors } from "../../boardutils";
import { MessageHandlerReflective } from "../../handlerapi";
import { Hitscan } from "../../hitscan";
import { EventBus } from "../messages";
import { stringEventConsumer } from "../../events";

export class JoinSectors extends MessageHandlerReflective {
  private sectorId1 = -1;
  private sectorId2 = -1;
  private eventConsumer = stringEventConsumer('join_sectors', (ctx: BuildContext) => this.join(ctx));

  private join(ctx: BuildContext) {
    let hit = ctx.state.get<Hitscan>('hitscan');
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

  public EventBus(msg: EventBus, ctx: BuildContext) {
    msg.events.tryConsume(this.eventConsumer, ctx);
  }
}