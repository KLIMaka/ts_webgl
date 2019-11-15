import { BuildContext } from "../../api";
import { joinSectors } from "../../boardutils";
import { MessageHandlerReflective } from "../../handlerapi";
import { Hitscan } from "../../hitscan";
import { NamedMessage } from "../messages";

export class JoinSectors extends MessageHandlerReflective {
  private sectorId1 = -1;
  private sectorId2 = -1;

  private join(ctx: BuildContext) {
    let hit = ctx.hitscan;
    if (this.sectorId1 == -1) {
      this.sectorId1 = hit.id;
    } else if (this.sectorId2 == -1) {
      this.sectorId2 = hit.id;
    }

    if (this.sectorId1 != -1 && this.sectorId2 != -1) {
      let result = joinSectors(ctx.board, this.sectorId1, this.sectorId2);
      if (result == 0) ctx.invalidator.invalidateAll();
      this.sectorId1 = -1;
      this.sectorId2 = -1;
    }
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    if (msg.name == 'join_sectors') this.join(ctx);
  }
}