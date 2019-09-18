import { Deck } from "../../../../deck";
import { Hitscan, isSector, isSprite, isWall } from "../../hitscan";
import { Board } from "../../structs";
import { sectorOfWall, ZSCALE, findSector } from "../../utils";
import { Context } from "../../gl/context";
import { Wireframe, Renderable, RenderableList } from "../../gl/renderable";
import { snap, getClosestSectorZ } from "../editutils";
import * as GLM from "../../../../../libs_js/glmatrix";
import { createInnerLoop, createNewSector, wallInSector, splitSector } from "../../boardutils";
import { BuildContext } from "../editapi";
import { tuple2 } from "../../../../../libs/mathutils";

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
    buff.allocate(size + 1 + 4, size * 2 + 4);

    for (let i = 0; i < size; i++) {
      let p = this.points[i];
      buff.writePos(i, p[0], this.z, p[1]);
      buff.writeLine(i * 2, i, i + 1);
    }
    buff.writePos(size, this.points[size][0], this.z, this.points[size][1]);

    let x = this.points[size][0];
    let y = this.points[size][1];
    let off = size + 1;
    off = buff.writePos(off, x, this.z, -32 * 1024);
    off = buff.writePos(off, x, this.z, 32 * 1024);
    buff.writeLine(size * 2, off - 1, off - 2);
    off = buff.writePos(off, -32 * 1024, this.z, y);
    off = buff.writePos(off, 32 * 1024, this.z, y);
    buff.writeLine(size * 2 + 2, off - 1, off - 2);
  }
}

export class DrawSector {
  private static zintersect: [number, number] = [0, 0];

  private points = new Deck<[number, number]>();
  private pointer = GLM.vec3.create();
  private hintSector = -1;
  private valid = false;
  private contour = new Contour();

  public update(board: Board, hit: Hitscan, context: BuildContext) {
    if (this.points.length() > 0) {
      let z = this.contour.getZ();
      let res = this.getIntersectionZPlane(hit);
      if (res == null) return;
      let [x, y] = res;
      x = context.snap(x);
      y = context.snap(y);
      GLM.vec3.set(this.pointer, x, y, z);
      this.contour.updateLastPoint(x, y);
    } else {
      if (hit.t == -1) {
        this.valid = false;
      } else {
        this.valid = true;
        let [x, y] = snap(hit, context);
        let z = this.getPointerZ(board, hit, x, y);
        GLM.vec3.set(this.pointer, x, y, z);
        this.contour.setZ(z / ZSCALE);
        this.contour.updateLastPoint(x, y);
        if (isSector(hit.type)) this.hintSector = hit.id;
        if (isSprite(hit.type)) this.hintSector = board.sprites[hit.id].sectnum;
        if (isWall(hit.type)) this.hintSector = sectorOfWall(board, hit.id);
      }
    }
  }

  private getIntersectionZPlane(hit: Hitscan): [number, number] {
    let z = this.contour.getZ();
    let dz = hit.start[2] / ZSCALE - z;
    let t = -dz / hit.vec[2];
    if (t < 0) return null;
    return tuple2(DrawSector.zintersect, hit.start[0] + hit.vec[0] * t, hit.start[1] + hit.vec[1] * t);
  }

  private isSplitSector(ctx: BuildContext, x: number, y: number) {
    let sectorId = this.findContainingSector(ctx);
    if (sectorId == -1) return -1;
    let fp = this.points.get(0);
    return wallInSector(ctx.board, sectorId, fp[0], fp[1]) != -1 && wallInSector(ctx.board, sectorId, x, y) != -1 ? sectorId : -1;
  }

  public insertPoint(ctx: BuildContext) {
    if (!this.valid) return;
    if (this.points.length() > 0) {
      let splitSector = this.isSplitSector(ctx, this.pointer[0], this.pointer[1]);
      if (splitSector != -1) {
        this.points.push([this.pointer[0], this.pointer[1]]);
        this.splitSector(ctx, splitSector);
        return;
      }
      let latsPoint = this.points.get(this.points.length() - 1);
      if (latsPoint[0] == this.pointer[0] && latsPoint[1] == this.pointer[1]) return;
      let firstPoint = this.points.get(0);
      if (firstPoint[0] == this.pointer[0] && firstPoint[1] == this.pointer[1]) {
        this.createSector(ctx);
        return;
      }
    }
    this.points.push([this.pointer[0], this.pointer[1]]);
    this.contour.pushPoint(this.pointer[0], this.pointer[1]);
  }

  public popPoint() {
    if (this.points.length() == 0) return;
    this.points.pop();
    this.contour.popPoint();
    this.contour.updateLastPoint(this.pointer[0], this.pointer[1]);
  }

  private getPointerZ(board: Board, hit: Hitscan, x: number, y: number): number {
    if (isSector(hit.type)) return hit.z;
    let sectorId = isWall(hit.type) ? sectorOfWall(board, hit.id) : board.sprites[hit.id].sectnum;
    return getClosestSectorZ(board, sectorId, x, y, hit.z)[1];
  }

  public getRenderable(): Renderable {
    return this.contour.getRenderable();
  }

  private findContainingSector(ctx: BuildContext) {
    let sectorId = this.hintSector;
    for (let i = 0; i < this.points.length(); i++) {
      let p = this.points.get(i);
      let w = wallInSector(ctx.board, this.hintSector, p[0], p[1]);
      let s = findSector(ctx.board, p[0], p[1], sectorId);
      if (w == -1 && s != sectorId) return -1;
    }
    return sectorId;
  }

  private createSector(ctx: BuildContext) {
    let sectorId = this.findContainingSector(ctx);
    if (sectorId != -1)
      createInnerLoop(ctx.board, sectorId, this.points);
    createNewSector(ctx.board, this.points);
    ctx.invalidateAll();
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

  private splitSector(ctx: BuildContext, sectorId: number) {
    if (splitSector(ctx.board, sectorId, this.points) != -1) {
      ctx.invalidateAll();
    }
    this.points.clear();
    this.contour.clear();
    this.contour.pushPoint(0, 0);
  }

}
