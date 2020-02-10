import { int } from "../../../../../libs/mathutils";
import { Texture } from "../../../../drawstruct";
import { State } from "../../../../stategl";
import { BuildContext } from "../../api";
import { walllen } from "../../boardutils";
import { Board } from "../../structs";
import { createSlopeCalculator, sectorOfWall, slope, ZSCALE } from "../../utils";
import { BuildBuffer } from "../buffers";
import { createGridMatrixProviderWall, text } from "../builders";
import { BuildRenderableProvider, GridRenderable, NULL_RENDERABLE, PointSprite, Renderable, RenderableList, Solid, WallRenderable, Wireframe } from "../renderable";
import { Builder } from "./api";
import { Mat4Array } from "../../../../../libs_js/glmatrix";

export class WallHelperBuilder implements Builder, WallRenderable {
  public top: Renderable;
  public mid: Renderable;
  public bot: Renderable;

  reset(): void {
    this.top.reset();
    this.mid.reset();
    this.bot.reset();
  }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    this.top.draw(ctx, gl, state);
    this.mid.draw(ctx, gl, state);
    this.bot.draw(ctx, gl, state);
  }

  get(): Renderable { return this }
}

function genQuadWireframe(coords: number[], normals: number[], buff: BuildBuffer) {
  buff.allocate(4, 8);
  let [x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4] = coords;
  buff.writePos(0, x1, z1, y1);
  buff.writePos(1, x2, z2, y2);
  buff.writePos(2, x3, z3, y3);
  buff.writePos(3, x4, z4, y4);
  if (normals != null) {
    buff.writeNormal(0, normals[0], normals[1], 0);
    buff.writeNormal(1, normals[2], normals[3], 0);
    buff.writeNormal(2, normals[4], normals[5], 0);
    buff.writeNormal(3, normals[6], normals[7], 0);
  }
  buff.writeLine(0, 0, 1);
  buff.writeLine(2, 1, 2);
  buff.writeLine(4, 2, 3);
  buff.writeLine(6, 3, 0);
}

export function updateWallWireframe(ctx: BuildContext, wallId: number): WallHelperBuilder {
  let top = NULL_RENDERABLE;
  let mid = NULL_RENDERABLE;
  let bot = NULL_RENDERABLE;
  const board = ctx.board;
  const wall = board.walls[wallId];
  const sectorId = sectorOfWall(board, wallId)
  const sector = board.sectors[sectorId];
  const wall2 = board.walls[wall.point2];
  const x1 = wall.x; const y1 = wall.y;
  const x2 = wall2.x; const y2 = wall2.y;
  const slope = createSlopeCalculator(board, sectorId);
  const ceilingheinum = sector.ceilingheinum;
  const ceilingz = sector.ceilingz;
  const floorheinum = sector.floorheinum;
  const floorz = sector.floorz;

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    const coords = getWallCoords(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    mid = new Wireframe();
    genQuadWireframe(coords, null, (<Wireframe>mid).buff);
  } else {
    const nextsector = board.sectors[wall.nextsector];
    const nextslope = createSlopeCalculator(board, wall.nextsector);
    const nextfloorz = nextsector.floorz;
    const nextceilingz = nextsector.ceilingz;

    const nextfloorheinum = nextsector.floorheinum;
    const botcoords = getWallCoords(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true, true);
    if (botcoords != null) {
      bot = new Wireframe();
      genQuadWireframe(botcoords, null, (<Wireframe>bot).buff);
    }

    const nextceilingheinum = nextsector.ceilingheinum;
    const topcoords = getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true, true);
    if (topcoords != null) {
      top = new Wireframe();
      genQuadWireframe(topcoords, null, (<Wireframe>top).buff);
    }

    if (wall.cstat.masking) {
      const coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      mid = new Wireframe();
      genQuadWireframe(coords, null, (<Wireframe>mid).buff);
    }
  }
  return new WallHelperBuilder(top, mid, bot);
}

function fillBufferForWallPoint(board: Board, wallId: number, buff: BuildBuffer, d: number, z: number) {
  buff.allocate(4, 6);
  let wall = board.walls[wallId];
  buff.writePos(0, wall.x, z, wall.y);
  buff.writePos(1, wall.x, z, wall.y);
  buff.writePos(2, wall.x, z, wall.y);
  buff.writePos(3, wall.x, z, wall.y);
  buff.writeNormal(0, -d, d, 0);
  buff.writeNormal(1, d, d, 0);
  buff.writeNormal(2, d, -d, 0);
  buff.writeNormal(3, -d, -d, 0);
  buff.writeTc(0, 0, 0);
  buff.writeTc(1, 1, 0);
  buff.writeTc(2, 1, 1);
  buff.writeTc(3, 0, 1);
  buff.writeQuad(0, 0, 1, 2, 3);
}

export function updateWallPointCeiling(ctx: BuildContext, wallId: number, tex: Texture) { return updateWallPoint(ctx, true, wallId, 2.5, tex) }
export function updateWallPointFloor(ctx: BuildContext, wallId: number, tex: Texture) { return updateWallPoint(ctx, false, wallId, 2.5, tex) }

function updateWallPoint(ctx: BuildContext, ceiling: boolean, wallId: number, d: number, tex: Texture): Renderable {
  const point = new PointSprite();
  const board = ctx.board;
  const s = sectorOfWall(board, wallId);
  const sec = board.sectors[s];
  const slope = createSlopeCalculator(board, s);
  const h = (ceiling ? sec.ceilingheinum : sec.floorheinum);
  const z = (ceiling ? sec.ceilingz : sec.floorz);
  const wall = board.walls[wallId];
  const zz = (slope(wall.x, wall.y, h) + z) / ZSCALE;
  fillBufferForWallPoint(board, wallId, point.buff, d, zz);
  point.tex = tex;
  return point;
}

function addWallPoints(wallId: number, ceiling: boolean): Renderable {
  const arr = new Array<Renderable>();
  const pointTex = this.ctx.art.get(-1);
  arr.push(ceiling ? updateWallPointCeiling(this.ctx, wallId, pointTex) : updateWallPointFloor(this.ctx, wallId, pointTex));
  const wallId2 = this.ctx.board.walls[wallId].point2;
  arr.push(ceiling ? updateWallPointCeiling(this.ctx, wallId2, pointTex) : updateWallPointFloor(this.ctx, wallId2, pointTex));
  const wall = this.ctx.board.walls[wallId];
  const wall2 = this.ctx.board.walls[wallId2];
  const cx = int(wall.x + (wall2.x - wall.x) * 0.5);
  const cy = int(wall.y + (wall2.y - wall.y) * 0.5);
  const sectorId = sectorOfWall(this.ctx.board, wallId);
  const sector = this.ctx.board.sectors[sectorId];
  const fz = slope(this.ctx.board, sectorId, cx, cy, sector.floorheinum) + sector.floorz;
  const cz = slope(this.ctx.board, sectorId, cx, cy, sector.ceilingheinum) + sector.ceilingz;
  const length = walllen(this.ctx.board, wallId).toFixed(2).replace(/\.00$/, "");
  arr.push(text(length, cx, cy, (ceiling ? cz : fz) / ZSCALE, 8, 8, this.ctx.art.get(-2)));
  return new RenderableList(arr);
}

function addWallPart(solid: Solid, matProvider: (scale: number) => Mat4Array, wire: Renderable, points: Renderable): Renderable {
  let arr = new Array<Renderable>();
  arr.push(wire);
  let wallGrid = new GridRenderable();
  wallGrid.gridTexMatProvider = matProvider;
  wallGrid.solid = solid;
  arr.push(wallGrid);
  arr.push(points);
  return new RenderableList(arr);
}

export function updateWallHelper(cache: BuildRenderableProvider, ctx: BuildContext, wallId: number, renderable: WallHelperBuilder): WallHelperBuilder {
  if (renderable == null) renderable = new WallHelperBuilder();
  renderable.reset();
  let wallWireframe = updateWallWireframe(ctx, wallId);
  let wallRenderable = cache.wall(wallId);
  let gridMatrix = createGridMatrixProviderWall(ctx.board, wallId);
  renderable.top = addWallPart(<Solid>wallRenderable.top, gridMatrix, wallWireframe.top, addWallPoints(wallId, true));
  renderable.mid = addWallPart(<Solid>wallRenderable.mid, gridMatrix, wallWireframe.mid, NULL_RENDERABLE);
  renderable.bot = addWallPart(<Solid>wallRenderable.bot, gridMatrix, wallWireframe.bot, addWallPoints(wallId, false));
  return renderable;
}