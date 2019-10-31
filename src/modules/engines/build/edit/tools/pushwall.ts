import { vec3 } from "../../../../../libs_js/glmatrix";
import { BuildContext } from "../../api";
import { MessageHandlerReflective } from "../../handlerapi";
import { Hitscan, isWall } from "../../hitscan";
import { wallNormal } from "../../utils";
import { NamedMessage } from "../messages";
import { createNewSector } from "../../boardutils";
import { Deck } from "../../../../collections";
import { int } from "../../../../../libs/mathutils";

let wallNormalResult = vec3.create();
export class PushWall extends MessageHandlerReflective {
  private wallId = -1;

  private start(ctx: BuildContext) {
    let hit = ctx.state.get<Hitscan>('hitscan');
    if (!isWall(hit.type)) return;
    this.wallId = hit.id;
    let [nx, _, ny] = wallNormal(wallNormalResult, ctx.board, this.wallId);
    let wall1 = ctx.board.walls[this.wallId];
    let wall2 = ctx.board.walls[wall1.point2];
    createNewSector(ctx.board, new Deck<[number, number]>()
      .push([wall1.x, wall1.y])
      .push([wall2.x, wall2.y])
      .push([wall2.x + int(nx * 128), wall1.y + int(ny * 128)])
      .push([wall1.x + int(nx * 128), wall1.y + int(ny * 128)])
    );
    ctx.invalidator.invalidateAll();
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'start_push_wall': this.start(ctx); return;
    }
  }
}