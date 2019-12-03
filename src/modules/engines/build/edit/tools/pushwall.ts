import { dot2d } from "../../../../../libs/mathutils";
import { vec3 } from "../../../../../libs_js/glmatrix";
import { cyclicPairs } from "../../../../collections";
import { BuildContext } from "../../api";
import { pushWall } from "../../boardutils";
import { Wireframe } from "../../gl/renderable";
import { MessageHandlerReflective } from "../../handlerapi";
import { isWall } from "../../hitscan";
import { build2gl, createSlopeCalculator, sectorOfWall, wallNormal, ZSCALE } from "../../utils";
import { MovingHandle } from "../handle";
import { Frame, NamedMessage, Render } from "../messages";

let wallNormal_ = vec3.create();
let wallNormal1_ = vec3.create();
let target_ = vec3.create();
let start_ = vec3.create();
let dir_ = vec3.create();
export class PushWall extends MessageHandlerReflective {
  private wallId = -1;
  private movingHandle = new MovingHandle();
  private wireframe = new Wireframe();

  private start(ctx: BuildContext) {
    const target = ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    this.wallId = target.entity.id;
    this.movingHandle.start(build2gl(target_, target.coords));
  }

  private stop(ctx: BuildContext, copy: boolean) {
    pushWall(ctx.board, this.wallId, this.getDistance(ctx), ctx.art, copy);
    ctx.commit();
    ctx.invalidator.invalidateAll();
    this.wallId = -1;
    this.movingHandle.stop();
  }

  private getDistance(ctx: BuildContext): number {
    let dx = this.movingHandle.dx;
    let dy = this.movingHandle.dy;
    let [nx, , ny] = wallNormal(wallNormal1_, ctx.board, this.wallId);
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
      const { start, dir } = ctx.view.dir();
      this.movingHandle.update(false, false, build2gl(start_, start), build2gl(dir_, dir));
    }
  }

  public Render(msg: Render, ctx: BuildContext) {
    if (!this.movingHandle.isActive()) return;
    this.updateWireframe(ctx);
    msg.list.push(this.wireframe);
  }

  private updateWireframe(ctx: BuildContext) {
    let buff = this.wireframe.buff;
    buff.allocate(8, 16);
    let normal = wallNormal(wallNormal_, ctx.board, this.wallId);
    let [nx, , ny] = vec3.scale(normal, normal, this.getDistance(ctx));
    let wall = ctx.board.walls[this.wallId];
    let wall2 = ctx.board.walls[wall.point2];
    let sectorId = sectorOfWall(ctx.board, this.wallId);
    let sector = ctx.board.sectors[sectorId];
    let x1 = wall.x + nx, y1 = wall.y + ny;
    let x2 = wall2.x + nx, y2 = wall2.y + ny;
    const slopeCalc = createSlopeCalculator(ctx.board, sectorId);
    const z1 = slopeCalc(x1, y1, sector.floorheinum) + sector.floorz;
    const z2 = slopeCalc(x1, y1, sector.ceilingheinum) + sector.ceilingz;
    const z3 = slopeCalc(x2, y2, sector.ceilingheinum) + sector.ceilingz;
    const z4 = slopeCalc(x2, y2, sector.floorheinum) + sector.floorz;
    const z5 = slopeCalc(wall.x, wall.y, sector.floorheinum) + sector.floorz;
    const z6 = slopeCalc(wall.x, wall.y, sector.ceilingheinum) + sector.ceilingz;
    const z7 = slopeCalc(wall2.x, wall2.y, sector.ceilingheinum) + sector.ceilingz;
    const z8 = slopeCalc(wall2.x, wall2.y, sector.floorheinum) + sector.floorz;
    buff.writePos(0, x1, z1 / ZSCALE, y1);
    buff.writePos(1, x1, z2 / ZSCALE, y1);
    buff.writePos(2, x2, z3 / ZSCALE, y2);
    buff.writePos(3, x2, z4 / ZSCALE, y2);
    buff.writePos(4, wall.x, z5 / ZSCALE, wall.y);
    buff.writePos(5, wall.x, z6 / ZSCALE, wall.y);
    buff.writePos(6, wall2.x, z7 / ZSCALE, wall2.y);
    buff.writePos(7, wall2.x, z8 / ZSCALE, wall2.y);
    for (let [i1, i2] of cyclicPairs(4)) buff.writeLine(i1 * 2, i1, i2);
    for (let i = 0; i < 4; i++) buff.writeLine(8 + i * 2, i, i + 4);
  }
}