import { len2d, int, dot2d } from "../../../../../libs/mathutils";
import { vec3 } from "../../../../../libs_js/glmatrix";
import { BuildContext } from "../../api";
import { pushWall } from "../../boardutils";
import { Wireframe } from "../../gl/renderable";
import { MessageHandlerReflective } from "../../handlerapi";
import { Hitscan, isWall } from "../../hitscan";
import { sectorOfWall, slope, wallNormal, ZSCALE } from "../../utils";
import { MovingHandle } from "../handle";
import { Frame, NamedMessage, Render } from "../messages";

let wallNormal_ = vec3.create();
let wallNormal1_ = vec3.create();
export class PushWall extends MessageHandlerReflective {
  private wallId = -1;
  private movingHandle = new MovingHandle();
  private wireframe = new Wireframe();

  private start(ctx: BuildContext) {
    let hit = ctx.state.get<Hitscan>('hitscan');
    if (!isWall(hit.type)) return;
    this.wallId = hit.id;
    this.movingHandle.start(hit);
  }

  private stop(ctx: BuildContext, copy: boolean) {
    pushWall(ctx.board, this.wallId, this.getDistance(ctx), ctx.art, [], copy);
    ctx.invalidator.invalidateAll();
    this.wallId = -1;
    this.movingHandle.stop();
  }

  private getDistance(ctx: BuildContext): number {
    let dx = this.movingHandle.dx;
    let dy = this.movingHandle.dy;
    let [nx, _, ny] = wallNormal(wallNormal1_, ctx.board, this.wallId);
    return ctx.snap(dot2d(nx, ny, dx, dy));
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'push_wall': this.movingHandle.isActive() ? this.stop(ctx, false) : this.start(ctx); return;
      case 'push_wall_copy': this.movingHandle.isActive() ? this.stop(ctx, true) : this.start(ctx); return;
    }
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    if (this.movingHandle.isActive()) {
      let hit = ctx.state.get<Hitscan>('hitscan');
      this.movingHandle.update(false, false, hit);
    }
  }

  public Render(msg: Render, ctx: BuildContext) {
    if (!this.movingHandle.isActive()) return;
    this.updateWireframe(ctx);
    msg.list.push(this.wireframe);
  }

  private updateWireframe(ctx: BuildContext) {
    let buff = this.wireframe.buff;
    buff.allocate(4, 8);
    let normal = wallNormal(wallNormal_, ctx.board, this.wallId);
    let [nx, _, ny] = vec3.scale(normal, normal, this.getDistance(ctx));
    let wall = ctx.board.walls[this.wallId];
    let wall2 = ctx.board.walls[wall.point2];
    let sectorId = sectorOfWall(ctx.board, this.wallId);
    let sector = ctx.board.sectors[sectorId];
    let x1 = wall.x + nx, y1 = wall.y + ny;
    let x2 = wall2.x + nx, y2 = wall2.y + ny;
    const z1 = slope(ctx.board, sectorId, x1, y1, sector.floorheinum) + sector.floorz;
    const z2 = slope(ctx.board, sectorId, x1, y1, sector.ceilingheinum) + sector.ceilingz;
    const z3 = slope(ctx.board, sectorId, x2, y2, sector.ceilingheinum) + sector.ceilingz;
    const z4 = slope(ctx.board, sectorId, x2, y2, sector.floorheinum) + sector.floorz;
    buff.writePos(0, x1, z1 / ZSCALE, y1);
    buff.writePos(1, x1, z2 / ZSCALE, y1);
    buff.writePos(2, x2, z3 / ZSCALE, y2);
    buff.writePos(3, x2, z4 / ZSCALE, y2);
    buff.writeLine(0, 0, 1);
    buff.writeLine(2, 1, 2);
    buff.writeLine(4, 2, 3);
    buff.writeLine(6, 3, 0);
  }
}