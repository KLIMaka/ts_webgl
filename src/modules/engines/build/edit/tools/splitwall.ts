import { splitWall } from "../../boardutils";
import { sectorOfWall } from "../../utils";
import { BuildContext } from "../editapi";
import { invalidateSectorAndWalls } from "../editutils";

export class SplitWall {
  private x = 0;
  private y = 0;
  private wallId = -1;
  private active = false;

  public deactivate() {
    this.active = false;
  }

  public update(x: number, y: number, wallId: number) {
    this.active = true;
    this.x = x;
    this.y = y;
    this.wallId = wallId;
  }

  public run(ctx: BuildContext) {
    if (!this.active)
      return;
    splitWall(ctx.board, this.wallId, this.x, this.y, ctx.art, []);
    let s = sectorOfWall(ctx.board, this.wallId);
    invalidateSectorAndWalls(s, ctx);
  }
}
