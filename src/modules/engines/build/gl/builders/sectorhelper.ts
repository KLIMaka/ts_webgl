import { Texture } from "../../../../drawstruct";
import { State } from "../../../../stategl";
import { BuildContext } from "../../api";
import { Board } from "../../structs";
import { createSlopeCalculator, sectorOfWall, ZSCALE } from "../../utils";
import { BuildBuffer } from "../buffers";
import { buildCeilingHinge, buildFloorHinge, gridMatrixProviderSector, updateSectorWireframe } from "../builders";
import { BuildRenderableProvider, GridRenderable, PointSprite, Renderable, RenderableList, SectorRenderable, Solid, wrapStatePred } from "../renderable";
import { Builder } from "./api";

export class SectorHelperBuilder implements Builder, SectorRenderable {
  public ceiling: Renderable;
  public floor: Renderable;

  reset(): void {
    this.ceiling.reset();
    this.floor.reset();
  }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    this.ceiling.draw(ctx, gl, state);
    this.floor.draw(ctx, gl, state);
  }

  get(): Renderable { return this }
}

function fillBufferForWallPoint(board: Board, wallId: number, buff: BuildBuffer, d: number, z: number) {
  buff.allocate(4, 6);
  const wall = board.walls[wallId];
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

export function updateSectorHelper(cache: BuildRenderableProvider, ctx: BuildContext, secId: number, builder: SectorHelperBuilder): SectorHelperBuilder {
  if (builder == null) builder = new SectorHelperBuilder();
  builder.reset();

  const ceiling2d = new Array<Renderable>();
  const floor2d = new Array<Renderable>();
  const pointTex = ctx.art.get(-1);

  const sec = ctx.board.sectors[secId];
  const end = sec.wallptr + sec.wallnum;
  for (let w = sec.wallptr; w < end; w++) {
    ceiling2d.push(updateWallPointCeiling(ctx, w, pointTex));
    floor2d.push(updateWallPointFloor(ctx, w, pointTex));
  }

  const ceiling = new Array<Renderable>();
  const floor = new Array<Renderable>();
  const sectorWireframe = updateSectorWireframe(ctx, secId);
  ceiling.push(sectorWireframe.ceiling);
  floor.push(sectorWireframe.floor);
  ceiling.push(buildCeilingHinge(ctx, secId));
  floor.push(buildFloorHinge(ctx, secId));
  const sectorRenderable = cache.sector(secId);
  const ceilingGrid = new GridRenderable();
  ceilingGrid.gridTexMatProvider = gridMatrixProviderSector;
  ceilingGrid.solid = <Solid>sectorRenderable.ceiling;
  ceiling.push(ceilingGrid);
  const floorGrid = new GridRenderable();
  floorGrid.gridTexMatProvider = gridMatrixProviderSector;
  floorGrid.solid = <Solid>sectorRenderable.floor;
  floor.push(floorGrid);

  const pred = (ctx: BuildContext) => !ctx.view.isWireframe();
  builder.ceiling = new RenderableList([wrapStatePred(pred, new RenderableList(ceiling)), ...ceiling2d]);
  builder.floor = new RenderableList([wrapStatePred(pred, new RenderableList(floor)), ...floor2d]);
  return builder;
}