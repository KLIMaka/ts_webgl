import { Deck } from "../../../../collections";
import { BuildContext, Target } from "../../api";
import { createInnerLoop, createNewSector, splitSector, wallInSector } from "../../boardutils";
import { Renderable, RenderableList, Wireframe } from "../../gl/renderable";
import { MessageHandlerReflective } from "../../handlerapi";
import { Board } from "../../structs";
import { findSector, sectorOfWall, ZSCALE } from "../../utils";
import { getClosestSectorZ } from "../editutils";
import { Frame, NamedMessage, Render, BoardInvalidate } from "../messages";
import { vec3 } from "../../../../../libs_js/glmatrix";

class Contour {
  private points: Array<[number, number]> = [];
  private size = 0;
  private z = 0;
  private contour = new Wireframe();
  private contourPoints = new Wireframe();
  private renderable = new RenderableList([this.contour, this.contourPoints]);

  constructor(firstPoint: boolean = true) {
    if (firstPoint)
      this.pushPoint(0, 0);
  }

  public setZ(z: number) {
    this.z = z;
  }

  public getZ() {
    return this.z;
  }

  public pushPoint(x: number, y: number) {
    this.points[this.size++] = [x, y];
  }

  public updatePoint(idx: number, x: number, y: number) {
    if (idx >= this.size) throw new Error('Invalid point id: ' + idx);
    let p = this.points[idx];
    p[0] = x;
    p[1] = y;
  }

  public updateLastPoint(x: number, y: number) {
    this.updatePoint(this.size - 1, x, y);
  }

  public popPoint() {
    this.size--;
  }

  public clear() {
    this.size = 0;
  }

  public getRenderable(): Renderable {
    this.updateRenderable();
    return this.renderable;
  }

  private updateRenderable() {
    if (this.size == 0) return;
    this.updateContourPoints();
    this.updateContour();
  }

  private updateContourPoints() {
    this.contourPoints.mode = WebGLRenderingContext.TRIANGLES;
    let buff = this.contourPoints.buff;
    buff.deallocate();
    buff.allocate(this.size * 4, this.size * 12);
    let d = 16;
    for (let i = 0; i < this.size; i++) {
      let p = this.points[i];
      let off = i * 4;
      buff.writePos(off + 0, p[0] - d, this.z, p[1] - d);
      buff.writePos(off + 1, p[0] + d, this.z, p[1] - d);
      buff.writePos(off + 2, p[0] + d, this.z, p[1] + d);
      buff.writePos(off + 3, p[0] - d, this.z, p[1] + d);
      buff.writeQuad(i * 12 + 0, off, off + 1, off + 2, off + 3);
      buff.writeQuad(i * 12 + 6, off + 3, off + 2, off + 1, off);
    }
  }

  private updateContour() {
    let buff = this.contour.buff;
    buff.deallocate();
    let size = this.size - 1;
    buff.allocate(size + 1, size * 2);

    for (let i = 0; i < size; i++) {
      let p = this.points[i];
      buff.writePos(i, p[0], this.z, p[1]);
      buff.writeLine(i * 2, i, i + 1);
    }
    buff.writePos(size, this.points[size][0], this.z, this.points[size][1]);
  }
}

export class DrawSector extends MessageHandlerReflective {
  // private static zintersect: [number, number] = [0, 0];

  private points = new Deck<[number, number]>();
  private pointer = vec3.create();
  private hintSector = -1;
  private valid = false;
  private contour = new Contour();
  private isRect = true;

  private update(ctx: BuildContext) {
    if (this.predrawUpdate(ctx)) return;

    let z = this.contour.getZ();
    const [x, y] = ctx.view.snapTarget().coords;
    vec3.set(this.pointer, x, y, z);

    if (this.isRect) {
      let fp = this.points.get(0);
      let dx = x - fp[0];
      let dy = y - fp[1];
      let p1 = this.points.get(1);
      let p2 = this.points.get(2);
      let p3 = this.points.get(3);
      p1[0] = fp[0] + dx;
      p2[0] = fp[0] + dx;
      p2[1] = fp[1] + dy;
      p3[1] = fp[1] + dy;
      this.contour.updatePoint(1, fp[0] + dx, fp[1]);
      this.contour.updatePoint(2, fp[0] + dx, fp[1] + dy);
      this.contour.updatePoint(3, fp[0], fp[1] + dy);
    } else {
      this.contour.updateLastPoint(x, y);
    }
  }

  private predrawUpdate(ctx: BuildContext) {
    if (this.points.length() > 0) return false;
    const target = ctx.view.snapTarget();
    if (target.entity == null) {
      this.valid = false;
    } else {
      this.valid = true;
      let [x, y,] = target.coords;
      let z = this.getPointerZ(ctx.board, target);
      vec3.set(this.pointer, x, y, z);
      this.contour.setZ(z / ZSCALE);
      this.contour.updateLastPoint(x, y);
      if (target.entity.isSector()) this.hintSector = target.entity.id;
      if (target.entity.isSprite()) this.hintSector = ctx.board.sprites[target.entity.id].sectnum;
      if (target.entity.isWall()) this.hintSector = sectorOfWall(ctx.board, target.entity.id);
    }
    return true;
  }

  // private getIntersectionZPlane(ctx: BuildContext): [number, number] {
  //   let snapped = snap(ctx);
  //   if (snapped != null) return tuple2(DrawSector.zintersect, snapped[0], snapped[1]);
  //   let z = this.contour.getZ();
  //   let dz = hit.ray.start[2] / ZSCALE - z;
  //   let t = -dz / hit.ray.dir[2];
  //   if (t < 0) return null;
  //   const x = ctx.snap(hit.ray.start[0] + hit.ray.dir[0] * t);
  //   const y = ctx.snap(hit.ray.start[1] + hit.ray.dir[1] * t);
  //   return tuple2(DrawSector.zintersect, x, y);
  // }

  private isSplitSector(ctx: BuildContext, x: number, y: number) {
    let sectorId = this.findContainingSector(ctx);
    if (sectorId == -1) return -1;
    let fp = this.points.get(0);
    return wallInSector(ctx.board, sectorId, fp[0], fp[1]) != -1 && wallInSector(ctx.board, sectorId, x, y) != -1 ? sectorId : -1;
  }

  private insertPoint(ctx: BuildContext, rect: boolean) {
    if (this.points.length() == 0) this.isRect = rect;
    if (!this.valid) return;
    if (this.checkFinish(ctx)) return;

    if (this.isRect) {
      for (let i = 0; i < 4; i++) {
        this.points.push([this.pointer[0], this.pointer[1]]);
        this.contour.pushPoint(this.pointer[0], this.pointer[1]);
      }
    } else {
      this.points.push([this.pointer[0], this.pointer[1]]);
      this.contour.pushPoint(this.pointer[0], this.pointer[1]);
    }
  }

  private checkFinish(ctx: BuildContext) {
    if (this.points.length() == 0) return false;

    let splitSector = this.isSplitSector(ctx, this.pointer[0], this.pointer[1]);
    if (splitSector != -1) {
      this.points.push([this.pointer[0], this.pointer[1]]);
      this.splitSector(ctx, splitSector);
      return true;
    }
    let latsPoint = this.points.get(this.points.length() - 1);
    if (latsPoint[0] == this.pointer[0] && latsPoint[1] == this.pointer[1]) return;
    let firstPoint = this.points.get(0);
    if (firstPoint[0] == this.pointer[0] && firstPoint[1] == this.pointer[1] || this.isRect) {
      this.createSector(ctx);
      return true;
    }
    return false;
  }

  private popPoint() {
    if (this.points.length() == 0) return;
    if (this.isRect) {
      for (let i = 0; i < 4; i++) {
        this.points.pop();
        this.contour.popPoint();
      }
    } else {
      this.points.pop();
      this.contour.popPoint();
    }
    this.contour.updateLastPoint(this.pointer[0], this.pointer[1]);
  }

  private getPointerZ(board: Board, target: Target): number {
    if (target.entity.isSector()) return target.coords[2];
    let sectorId = target.entity.isWall() ? sectorOfWall(board, target.entity.id) : board.sprites[target.entity.id].sectnum;
    return getClosestSectorZ(board, sectorId, target.coords[0], target.coords[1], target.coords[2])[1];
  }

  private findContainingSector(ctx: BuildContext) {
    let sectorId = this.hintSector;
    for (let p of this.points) {
      let s = findSector(ctx.board, p[0], p[1], sectorId);
      if (s != sectorId) return -1;
    }
    return sectorId;
  }

  private createSector(ctx: BuildContext) {
    let sectorId = this.findContainingSector(ctx);
    if (sectorId != -1)
      createInnerLoop(ctx.board, sectorId, this.points, ctx.refs);
    createNewSector(ctx.board, this.points, ctx.refs);
    ctx.commit();
    ctx.message(new BoardInvalidate(null));
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  private splitSector(ctx: BuildContext, sectorId: number) {
    if (splitSector(ctx.board, sectorId, this.points, ctx.refs) != -1) {
      ctx.commit();
      ctx.message(new BoardInvalidate(null));
    }
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'draw_rect_wall': this.insertPoint(ctx, true); return;
      case 'draw_wall': this.insertPoint(ctx, false); return;
      case 'undo_draw_wall': this.popPoint(); return;
    }
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    this.update(ctx);
  }

  public Render(msg: Render, ctx: BuildContext) {
    msg.list.push(this.contour.getRenderable());
  }
}
