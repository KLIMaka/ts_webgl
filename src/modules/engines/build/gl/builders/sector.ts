import { SectorRenderable, Solid, Renderable } from "../renderable";
import { Builder } from "./api";
import { BuildContext } from "../../api";
import { State } from "../../../../stategl";
import { vec3, mat4, vec4, Vec3Array, Mat4Array } from "../../../../../libs_js/glmatrix";
import { getFirstWallAngle, createSlopeCalculator, ZSCALE, sectorNormal } from "../../utils";
import { Sector, Wall, Board } from "../../structs";
import { ArtInfo } from "../../art";
import { BuildBuffer } from "../buffers";
import { SectorSolid } from "../builders";
import { tesselate } from "../../../../../libs_js/glutess";


export class SectorBuilder implements Builder, SectorRenderable {
  readonly ceiling = new Solid();
  readonly floor = new Solid();

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

function applySectorTextureTransform(sector: Sector, ceiling: boolean, walls: Wall[], info: ArtInfo, texMat: Mat4Array) {
  const xpan = (ceiling ? sector.ceilingxpanning : sector.floorxpanning) / 256.0;
  const ypan = (ceiling ? sector.ceilingypanning : sector.floorypanning) / 256.0;
  const stats = ceiling ? sector.ceilingstat : sector.floorstat;
  const scale = stats.doubleSmooshiness ? 8.0 : 16.0;
  const parallaxscale = stats.parallaxing ? 6.0 : 1.0;
  const tcscalex = (stats.xflip ? -1.0 : 1.0) / (info.w * scale * parallaxscale);
  const tcscaley = (stats.yflip ? -1.0 : 1.0) / (info.h * scale);
  mat4.identity(texMat);
  mat4.translate(texMat, texMat, [xpan, ypan, 0, 0]);
  mat4.scale(texMat, texMat, [tcscalex, -tcscaley, 1, 1]);
  if (stats.swapXY) {
    mat4.scale(texMat, texMat, [-1, -1, 1, 1]);
    mat4.rotateZ(texMat, texMat, Math.PI / 2);
  }
  if (stats.alignToFirstWall) {
    const w1 = walls[sector.wallptr];
    mat4.rotateZ(texMat, texMat, getFirstWallAngle(sector, walls));
    mat4.translate(texMat, texMat, [-w1.x, -w1.y, 0, 0])
  }
  mat4.rotateX(texMat, texMat, -Math.PI / 2);
}

const tc_ = vec4.create();
function fillBuffersForSectorNormal(ceil: boolean, board: Board, s: number, sec: Sector, buff: BuildBuffer, vtxs: number[][], vidxs: number[], normal: Vec3Array, t: Mat4Array) {
  const heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  const z = ceil ? sec.ceilingz : sec.floorz;
  const slope = createSlopeCalculator(board, s);

  for (let i = 0; i < vtxs.length; i++) {
    const vx = vtxs[i][0];
    const vy = vtxs[i][1];
    const vz = (slope(vx, vy, heinum) + z) / ZSCALE;
    buff.writePos(i, vx, vz, vy);
    buff.writeNormal(i, normal[0], normal[1], normal[2]);
    vec4.transformMat4(tc_, vec4.set(tc_, vx, vz, vy, 1), t);
    buff.writeTc(i, tc_[0], tc_[1]);
  }

  for (let i = 0; i < vidxs.length; i += 3) {
    if (ceil) {
      buff.writeTriangle(i, vidxs[i + 0], vidxs[i + 1], vidxs[i + 2]);
    } else {
      buff.writeTriangle(i, vidxs[i + 2], vidxs[i + 1], vidxs[i + 0]);
    }
  }
}


function triangulate(sector: Sector, walls: Wall[]): [number[][], number[]] {
  let contour = [];
  let contours = [];
  for (let w = 0; w < sector.wallnum; w++) {
    let wid = sector.wallptr + w;
    let wall = walls[wid];
    contour.push(wall.x, wall.y);
    if (wall.point2 < wid) {
      contours.push(contour);
      contour = [];
    }
  }
  return tesselate(contours);
}

function cacheTriangulate(board: Board, sec: Sector): [number[][], number[]] {
  return triangulate(sec, board.walls);
}

function fillBuffersForSector(ceil: boolean, board: Board, s: number, sec: Sector, renderable: SectorSolid, normal: Vec3Array, t: Mat4Array) {
  const [vtxs, vidxs] = cacheTriangulate(board, sec);
  const d = ceil ? renderable.ceiling : renderable.floor;
  d.buff.allocate(vtxs.length, vidxs.length);
  fillBuffersForSectorNormal(ceil, board, s, sec, d.buff, vtxs, vidxs, normal, t);
}

let sectorNormal_ = vec3.create();
export function updateSector(ctx: BuildContext, secId: number, builder: SectorBuilder): SectorBuilder {
  if (builder == null) builder = new SectorBuilder();
  const board = ctx.board;
  const art = ctx.art;
  const sec = board.sectors[secId];

  const ceilinginfo = art.getInfo(sec.ceilingpicnum);
  applySectorTextureTransform(sec, true, board.walls, ceilinginfo, builder.ceiling.texMat);
  fillBuffersForSector(true, board, secId, sec, builder, sectorNormal(sectorNormal_, board, secId, true), builder.ceiling.texMat);
  builder.ceiling.tex = sec.ceilingstat.parallaxing ? art.getParallaxTexture(sec.ceilingpicnum) : art.get(sec.ceilingpicnum);
  builder.ceiling.parallax = sec.ceilingstat.parallaxing;
  builder.ceiling.pal = sec.ceilingpal;
  builder.ceiling.shade = sec.ceilingshade;

  const floorinfo = art.getInfo(sec.floorpicnum);
  applySectorTextureTransform(sec, false, board.walls, floorinfo, builder.floor.texMat);
  fillBuffersForSector(false, board, secId, sec, builder, sectorNormal(sectorNormal_, board, secId, false), builder.floor.texMat);
  builder.floor.tex = sec.floorstat.parallaxing ? art.getParallaxTexture(sec.floorpicnum) : art.get(sec.floorpicnum);
  builder.floor.parallax = sec.floorstat.parallaxing;
  builder.floor.pal = sec.floorpal;
  builder.floor.shade = sec.floorshade;

  return builder;
}