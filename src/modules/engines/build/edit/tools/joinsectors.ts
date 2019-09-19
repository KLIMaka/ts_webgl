import { joinSectors } from "../../boardutils";
import { Hitscan } from "../../hitscan";
import { BuildContext } from "../editapi";

export class JoinSectors {
  private sectorId1 = -1;
  private sectorId2 = -1;

  public join(hit: Hitscan, ctx: BuildContext) {
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
}