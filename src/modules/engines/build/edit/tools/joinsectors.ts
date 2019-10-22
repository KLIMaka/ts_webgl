import { joinSectors } from "../../boardutils";
import { Hitscan } from "../../hitscan";
import { BuildContext } from "../../api";
import { MessageHandlerReflective } from "../../handlerapi";
import { HitScan, Input } from "../messages";
import { action } from "../../../../keymap";

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
      console.log('joining ' + this.sectorId1 + ' and ' + this.sectorId2);
      let result = joinSectors(ctx.board, this.sectorId1, this.sectorId2);
      if (result == 0) ctx.invalidator.invalidateAll();
      this.sectorId1 = -1;
      this.sectorId2 = -1;
    }
  }

  public HitScan(msg: HitScan, ctx: BuildContext) {
    this.hit = msg.hit;
  }

  public Input(msg: Input, ctx: BuildContext) {
    if (action('join_sectors', msg.state)) this.join(this.hit, ctx);
  }
}