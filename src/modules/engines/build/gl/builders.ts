import * as MU from '../../../../libs/mathutils';
import * as GLM from '../../../../libs_js/glmatrix';
import { tesselate } from '../../../../libs_js/glutess';
import { ArtInfo } from '../art';
import { walllen } from '../boardutils';
import { isSector, isWall, SubType } from '../hitscan';
import { Board, FACE, FLOOR, Sector, Wall, WALL } from '../structs';
import * as U from '../utils';
import { Buffer, NULL_RENDERABLE, Renderable, Type, Wireframe, Solid, SectorRenderable } from './renderable';
import { State } from '../../../stategl';
import { BuildContext } from '../api';

export class SectorSolid implements Renderable {
  public ceiling: Solid = new Solid();
  public floor: Solid = new Solid();

  draw(gl: WebGLRenderingContext, state: State) {
    this.ceiling.draw(gl, state);
    this.floor.draw(gl, state);
  }

  reset() {
    this.ceiling.reset();
    this.floor.reset();
  }
}

export class WallSolid implements Renderable {
  public top: Solid = new Solid();
  public mid: Solid = new Solid();
  public bot: Solid = new Solid();

  draw(gl: WebGLRenderingContext, state: State) {
    this.top.draw(gl, state);
    this.mid.draw(gl, state);
    this.bot.draw(gl, state);
  }

  reset() {
    this.top.reset();
    this.mid.reset();
    this.bot.reset();
  }
}

export class SectorHelper implements Renderable {
  constructor(
    public ceiling: Renderable = NULL_RENDERABLE,
    public floor: Renderable = NULL_RENDERABLE
  ) { }

  draw(gl: WebGLRenderingContext, state: State) {
    this.ceiling.draw(gl, state);
    this.floor.draw(gl, state);
  }

  reset() {
    this.ceiling.reset();
    this.floor.reset();
  }
}

export class WallHelper implements Renderable {
  constructor(
    public top: Renderable = NULL_RENDERABLE,
    public mid: Renderable = NULL_RENDERABLE,
    public bot: Renderable = NULL_RENDERABLE
  ) { }

  draw(gl: WebGLRenderingContext, state: State) {
    this.top.draw(gl, state);
    this.mid.draw(gl, state);
    this.bot.draw(gl, state);
  }

  reset() {
    this.top.reset();
    this.mid.reset();
    this.bot.reset();
  }
}

export function updateSector2d(ctx: BuildContext, sectorId: number): SectorRenderable {

}

let tmp = GLM.vec4.create();
let texMat = GLM.mat4.create();
export function genGridMatrix(board: Board, id: number, type: SubType): GLM.Mat4Array {
  GLM.mat4.identity(texMat);
  if (isSector(type)) {
    GLM.vec4.set(tmp, 1 / 512, 1 / 512, 1, 1);
    GLM.mat4.scale(texMat, texMat, tmp);
    GLM.mat4.rotateX(texMat, texMat, Math.PI / 2);
  } else if (isWall(type)) {
    let wall1 = board.walls[id];
    let wall2 = board.walls[wall1.point2];
    let dx = wall2.x - wall1.x;
    let dy = wall2.y - wall1.y;
    let d = 128 / (walllen(board, id) / wall1.xrepeat);
    GLM.vec4.set(tmp, d / 512, 1 / 512, 1, 1);
    GLM.mat4.scale(texMat, texMat, tmp);
    GLM.mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
    GLM.vec4.set(tmp, -wall1.x, 0, -wall1.y, 0);
    GLM.mat4.translate(texMat, texMat, tmp);
  }
  return texMat;
}

export function updateWallLine(ctx: BuildContext, wallId: number): Wireframe {
  let line = new Wireframe();
  let board = ctx.board;
  let buff = line.buff;
  buff.allocate(2, 2);
  let sectorId = U.sectorOfWall(board, wallId);
  let sector = board.sectors[sectorId];
  let wall = board.walls[wallId];
  let fz = sector.floorz + U.slope(board, sectorId, wall.x, wall.y, sector.floorheinum);
  let cz = sector.ceilingz + U.slope(board, sectorId, wall.x, wall.y, sector.ceilingheinum);
  buff.writePos(0, wall.x, fz / U.ZSCALE, wall.y);
  buff.writePos(1, wall.x, cz / U.ZSCALE, wall.y);
  buff.writeLine(0, 0, 1);
  return line;
}

export function buildCeilingHinge(ctx: BuildContext, sectorId: number): Wireframe { return prepareHinge(ctx, sectorId, true) }
export function buildFloorHinge(ctx: BuildContext, sectorId: number): Wireframe { return prepareHinge(ctx, sectorId, false) }

function prepareHinge(ctx: BuildContext, sectorId: number, ceiling: boolean): Wireframe {
  let hinge = new Wireframe();
  let board = ctx.board;
  hinge.mode = WebGLRenderingContext.TRIANGLES;
  GLM.vec4.set(hinge.color, 0.7, 0.7, 0.7, 0.7);
  let size = 128;
  let buff = hinge.buff;
  buff.allocate(6, 24);
  let sec = board.sectors[sectorId];
  let wall1 = board.walls[sec.wallptr];
  let wall2 = board.walls[wall1.point2];
  let dx = (wall2.x - wall1.x); let dy = (wall2.y - wall1.y);
  let dl = MU.len2d(dx, dy);
  let x = wall1.x + dx / 2; let y = wall1.y + dy / 2;
  dx /= dl; dy /= dl;
  let z = (ceiling ? sec.ceilingz : sec.floorz) / U.ZSCALE;
  let dz = ceiling ? -size / 2 : size / 2;
  let x1 = x - dx * size; let y1 = y - dy * size;
  let x2 = x + dx * size; let y2 = y + dy * size;
  let x3 = x1 - dy * (size / 2); let y3 = y1 + dx * (size / 2);
  let x4 = x2 - dy * (size / 2); let y4 = y2 + dx * (size / 2);
  let heinum = ceiling ? sec.ceilingheinum : sec.floorheinum;
  let slope = U.slope(board, sectorId, x3, y3, heinum) / U.ZSCALE;
  buff.writePos(0, x1, z, y1);
  buff.writePos(1, x2, z, y2);
  buff.writePos(2, x3, z + slope, y3);
  buff.writePos(3, x4, z + slope, y4);
  buff.writePos(4, x1, z + dz, y1);
  buff.writePos(5, x2, z + dz, y2);
  buff.writeQuad(0, 0, 1, 3, 2);
  buff.writeQuad(6, 2, 3, 1, 0);
  buff.writeQuad(12, 0, 1, 5, 4);
  buff.writeQuad(18, 4, 5, 1, 0);
  return hinge;
}

export function updateSpriteAngle(ctx: BuildContext, spriteId: number): Wireframe {
  let arrow = new Wireframe();
  arrow.mode = WebGLRenderingContext.TRIANGLES;
  let buff = arrow.buff;
  buff.allocate(3, 6);
  let spr = ctx.board.sprites[spriteId];
  let x = spr.x, y = spr.y, z = spr.z / U.ZSCALE;
  let ang = U.spriteAngle(spr.ang);
  let size = 128;
  let vec1 = U.ang2vec(ang);
  GLM.vec3.scale(vec1, vec1, size);
  let vec2 = U.ang2vec(ang + Math.PI / 2);
  GLM.vec3.scale(vec2, vec2, size / 4);
  buff.writePos(0, x + vec1[0], z, y + vec1[2]);
  buff.writePos(1, x + vec2[0], z, y + vec2[2]);
  buff.writePos(2, x - vec2[0], z, y - vec2[2]);
  buff.writeTriangle(0, 0, 1, 2);
  buff.writeTriangle(3, 2, 1, 0);
  return arrow;
}

function fillBufferForWallPoint(board: Board, wallId: number, buff: Buffer, d: number, z: number) {
  buff.allocate(4, 12);
  let wall = board.walls[wallId];
  buff.writePos(0, wall.x - d, z, wall.y - d);
  buff.writePos(1, wall.x + d, z, wall.y - d);
  buff.writePos(2, wall.x + d, z, wall.y + d);
  buff.writePos(3, wall.x - d, z, wall.y + d);
  buff.writeQuad(0, 0, 1, 2, 3);
  buff.writeQuad(6, 3, 2, 1, 0);
}

export function updateWallPointCeiling(ctx: BuildContext, wallId: number) { return updateWallPoint(ctx, true, wallId, 32) }
export function updateWallPointFloor(ctx: BuildContext, wallId: number) { return updateWallPoint(ctx, false, wallId, 32) }

function updateWallPoint(ctx: BuildContext, ceiling: boolean, wallId: number, d: number): Wireframe {
  let point = new Wireframe();
  let board = ctx.board;
  point.mode = WebGLRenderingContext.TRIANGLES;
  let s = U.sectorOfWall(board, wallId);
  let sec = board.sectors[s];
  let slope = U.createSlopeCalculator(sec, board.walls);
  let h = (ceiling ? sec.ceilingheinum : sec.floorheinum);
  let z = (ceiling ? sec.ceilingz : sec.floorz);
  let wall = board.walls[wallId];
  let zz = (slope(wall.x, wall.y, h) + z) / U.ZSCALE;
  fillBufferForWallPoint(board, wallId, point.buff, d, zz);
  return point;
}

function fillBuffersForSectorWireframe(sec: Sector, heinum: number, z: number, board: Board, buff: Buffer) {
  let slope = U.createSlopeCalculator(sec, board.walls);
  buff.allocate(sec.wallnum, sec.wallnum * 2);

  let fw = sec.wallptr;
  let off = 0;
  for (let w = 0; w < sec.wallnum; w++) {
    let wid = sec.wallptr + w;
    let wall = board.walls[wid];
    let vx = wall.x;
    let vy = wall.y;
    let vz = (slope(vx, vy, heinum) + z) / U.ZSCALE;
    buff.writePos(w, vx, vz, vy);
    if (fw != wid) {
      off = buff.writeLine(off, w - 1, w);
    }
    if (wall.point2 == fw) {
      off = buff.writeLine(off, w, fw - sec.wallptr);
      fw = wid + 1;
    }
  }
}
export function buildSectorWireframe(ctx: BuildContext, secId: number): SectorHelper {
  let board = ctx.board;
  let ceiling = new Wireframe();
  let floor = new Wireframe();
  let sec = board.sectors[secId];
  fillBuffersForSectorWireframe(sec, sec.ceilingheinum, sec.ceilingz, board, ceiling.buff);
  fillBuffersForSectorWireframe(sec, sec.floorheinum, sec.floorz, board, floor.buff);
  return new SectorHelper(ceiling, floor);
}

function genQuadWireframe(coords: number[], normals: number[], buff: Buffer) {
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

export function updateWallWireframe(ctx: BuildContext, wallId: number): WallHelper {
  let top = NULL_RENDERABLE;
  let mid = NULL_RENDERABLE;
  let bot = NULL_RENDERABLE;
  let board = ctx.board;
  let wall = board.walls[wallId];
  let sector = board.sectors[U.sectorOfWall(board, wallId)];
  let wall2 = board.walls[wall.point2];
  let x1 = wall.x; let y1 = wall.y;
  let x2 = wall2.x; let y2 = wall2.y;
  let slope = U.createSlopeCalculator(sector, board.walls);
  let ceilingheinum = sector.ceilingheinum;
  let ceilingz = sector.ceilingz;
  let floorheinum = sector.floorheinum;
  let floorz = sector.floorz;

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    let coords = getWallCoords(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    mid = new Wireframe();
    genQuadWireframe(coords, null, (<Wireframe>mid).buff);
  } else {
    let nextsector = board.sectors[wall.nextsector];
    let nextslope = U.createSlopeCalculator(nextsector, board.walls);
    let nextfloorz = nextsector.floorz;
    let nextceilingz = nextsector.ceilingz;

    let nextfloorheinum = nextsector.floorheinum;
    let botcoords = getWallCoords(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true, true);
    if (botcoords != null) {
      bot = new Wireframe();
      genQuadWireframe(botcoords, null, (<Wireframe>bot).buff);
    }

    let nextceilingheinum = nextsector.ceilingheinum;
    let topcoords = getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true, true);
    if (topcoords != null) {
      top = new Wireframe();
      genQuadWireframe(topcoords, null, (<Wireframe>top).buff);
    }

    if (wall.cstat.masking) {
      let coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      mid = new Wireframe();
      genQuadWireframe(coords, null, (<Wireframe>mid).buff);
    }
  }
  return new WallHelper(top, mid, bot);
}

function fillbuffersForWallSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, renderable: Wireframe) {
  let dx = Math.sin(ang) * hw;
  let dy = Math.cos(ang) * hw;
  genQuadWireframe([
    x - dx, y - dy, z - hh + yo,
    x + dx, y + dy, z - hh + yo,
    x + dx, y + dy, z + hh + yo,
    x - dx, y - dy, z + hh + yo],
    null, renderable.buff);
}

function fillbuffersForFloorSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, renderable: Wireframe) {
  let dwx = Math.sin(ang) * hw;
  let dwy = Math.cos(ang) * hw;
  let dhx = Math.sin(ang + Math.PI / 2) * hh;
  let dhy = Math.cos(ang + Math.PI / 2) * hh;
  genQuadWireframe([
    x - dwx - dhx, y - dwy - dhy, z,
    x + dwx - dhx, y + dwy - dhy, z,
    x + dwx + dhx, y + dwy + dhy, z,
    x - dwx + dhx, y - dwy + dhy, z],
    null, renderable.buff);
}

function fillBuffersForFaceSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, renderable: Wireframe) {
  genQuadWireframe([
    x, y, z,
    x, y, z,
    x, y, z,
    x, y, z
  ], [
    -hw + xo, +hh + yo,
    +hw + xo, +hh + yo,
    +hw + xo, -hh + yo,
    -hw + xo, -hh + yo],
    renderable.buff);
}


export function updateSpriteWireframe(ctx: BuildContext, sprId: number): Renderable {
  let spr = ctx.board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible)
    return NULL_RENDERABLE;

  let wireframe = new Wireframe();
  let x = spr.x; let y = spr.y; let z = spr.z / U.ZSCALE;
  let info = ctx.art.getInfo(spr.picnum);
  let w = (info.w * spr.xrepeat) / 4; let hw = w >> 1;
  let h = (info.h * spr.yrepeat) / 4; let hh = h >> 1;
  let ang = U.spriteAngle(spr.ang);
  let xo = (info.attrs.xoff * spr.xrepeat) / 4;
  let yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);

  if (spr.cstat.type == FACE) {
    wireframe.type = Type.FACE;
    fillBuffersForFaceSpriteWireframe(x, y, z, xo, yo, hw, hh, wireframe);
  } else if (spr.cstat.type == WALL) {
    wireframe.type = Type.SURFACE;
    fillbuffersForWallSpriteWireframe(x, y, z, xo, yo, hw, hh, ang, wireframe);
  } else if (spr.cstat.type == FLOOR) {
    wireframe.type = Type.SURFACE;
    fillbuffersForFloorSpriteWireframe(x, y, z, xo, yo, hw, hh, ang, wireframe);
  }
  return wireframe;
}

function applySectorTextureTransform(sector: Sector, ceiling: boolean, walls: Wall[], info: ArtInfo, texMat: GLM.Mat4Array) {
  let xpan = (ceiling ? sector.ceilingxpanning : sector.floorxpanning) / 256.0;
  let ypan = (ceiling ? sector.ceilingypanning : sector.floorypanning) / 256.0;
  let stats = ceiling ? sector.ceilingstat : sector.floorstat;
  let scale = stats.doubleSmooshiness ? 8.0 : 16.0;
  let parallaxscale = stats.parallaxing ? 6.0 : 1.0;
  let tcscalex = (stats.xflip ? -1.0 : 1.0) / (info.w * scale * parallaxscale);
  let tcscaley = (stats.yflip ? -1.0 : 1.0) / (info.h * scale);
  GLM.mat4.identity(texMat);
  GLM.mat4.translate(texMat, texMat, [xpan, ypan, 0, 0]);
  GLM.mat4.scale(texMat, texMat, [tcscalex, -tcscaley, 1, 1]);
  if (stats.swapXY) {
    GLM.mat4.scale(texMat, texMat, [-1, -1, 1, 1]);
    GLM.mat4.rotateZ(texMat, texMat, Math.PI / 2);
  }
  if (stats.alignToFirstWall) {
    let w1 = walls[sector.wallptr];
    GLM.mat4.rotateZ(texMat, texMat, U.getFirstWallAngle(sector, walls));
    GLM.mat4.translate(texMat, texMat, [-w1.x, -w1.y, 0, 0])
  }
  GLM.mat4.rotateX(texMat, texMat, -Math.PI / 2);
}

function triangulate(sector: Sector, walls: Wall[]): number[][] {
  let contour = [];
  let contours = [];
  let fw = sector.wallptr;
  for (let w = 0; w < sector.wallnum; w++) {
    let wid = sector.wallptr + w;
    let wall = walls[wid];
    contour.push(wall.x, wall.y);
    if (wall.point2 == fw) {
      contours.push(contour);
      contour = [];
      fw = wid + 1;
    }
  }
  return tesselate(contours);
}

function cacheTriangulate(board: Board, sec: Sector): any {
  return triangulate(sec, board.walls);
}

let tc = GLM.vec4.create();
function fillBuffersForSectorNormal(ceil: boolean, board: Board, sec: Sector, buff: Buffer, vtxs: number[][], vidxs: number[], normal: GLM.Vec3Array, t: GLM.Mat4Array) {
  let heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  let z = ceil ? sec.ceilingz : sec.floorz;
  let slope = U.createSlopeCalculator(sec, board.walls);

  for (let i = 0; i < vtxs.length; i++) {
    let vx = vtxs[i][0];
    let vy = vtxs[i][1];
    let vz = (slope(vx, vy, heinum) + z) / U.ZSCALE;
    buff.writePos(i, vx, vz, vy);
    buff.writeNormal(i, normal[0], normal[1], normal[2]);
    GLM.vec4.transformMat4(tc, GLM.vec4.set(tc, vx, vz, vy, 1), t);
    buff.writeTc(i, tc[0], tc[1]);
  }

  for (let i = 0; i < vidxs.length; i += 3) {
    if (ceil) {
      buff.writeTriangle(i, vidxs[i + 0], vidxs[i + 1], vidxs[i + 2]);
    } else {
      buff.writeTriangle(i, vidxs[i + 2], vidxs[i + 1], vidxs[i + 0]);
    }
  }
}

function fillBuffersForSector(ceil: boolean, board: Board, sec: Sector, renderable: SectorSolid, normal: GLM.Vec3Array, t: GLM.Mat4Array) {
  let [vtxs, vidxs] = cacheTriangulate(board, sec);
  let d = ceil ? renderable.ceiling : renderable.floor;
  d.buff.allocate(vtxs.length, vidxs.length);
  fillBuffersForSectorNormal(ceil, board, sec, d.buff, vtxs, vidxs, normal, t);
}

let sectorNormal = GLM.vec3.create();
export function updateSector(ctx: BuildContext, secId: number, renderable: SectorSolid): SectorSolid {
  if (renderable == null) renderable = new SectorSolid();
  let board = ctx.board;
  let art = ctx.art;
  let sec = board.sectors[secId];
  let ceilinginfo = art.getInfo(sec.ceilingpicnum);
  applySectorTextureTransform(sec, true, board.walls, ceilinginfo, renderable.ceiling.texMat);
  fillBuffersForSector(true, board, sec, renderable, U.sectorNormal(sectorNormal, board, secId, true), renderable.ceiling.texMat);
  renderable.ceiling.tex = sec.ceilingstat.parallaxing ? art.getParallaxTexture(sec.ceilingpicnum) : art.get(sec.ceilingpicnum);
  renderable.ceiling.parallax = sec.ceilingstat.parallaxing;
  renderable.ceiling.pal = sec.ceilingpal;
  renderable.ceiling.shade = sec.ceilingshade;

  let floorinfo = art.getInfo(sec.floorpicnum);
  applySectorTextureTransform(sec, false, board.walls, floorinfo, renderable.floor.texMat);
  fillBuffersForSector(false, board, sec, renderable, U.sectorNormal(sectorNormal, board, secId, false), renderable.floor.texMat);
  renderable.floor.tex = sec.floorstat.parallaxing ? art.getParallaxTexture(sec.floorpicnum) : art.get(sec.floorpicnum);
  renderable.floor.parallax = sec.floorstat.parallaxing;
  renderable.floor.pal = sec.floorpal;
  renderable.floor.shade = sec.floorshade;

  return renderable;
}

function getWallCoords(x1: number, y1: number, x2: number, y2: number,
  slope: any, nextslope: any, heinum: number, nextheinum: number, z: number, nextz: number, check: boolean, line = false): number[] {
  let z1 = (slope(x1, y1, heinum) + z) / U.ZSCALE;
  let z2 = (slope(x2, y2, heinum) + z) / U.ZSCALE;
  let z3 = (nextslope(x2, y2, nextheinum) + nextz) / U.ZSCALE;
  let z4 = (nextslope(x1, y1, nextheinum) + nextz) / U.ZSCALE;
  if (check) {
    if (line && z4 > z1 && z3 > z2) return null;
    if (!line && z4 >= z1 && z3 >= z2) return null;
  }
  return [x1, y1, z1, x2, y2, z2, x2, y2, z3, x1, y1, z4];
}

function getMaskedWallCoords(x1: number, y1: number, x2: number, y2: number, slope: any, nextslope: any,
  ceilheinum: number, ceilnextheinum: number, ceilz: number, ceilnextz: number,
  floorheinum: number, floornextheinum: number, floorz: number, floornextz: number): number[] {
  let currz1 = (slope(x1, y1, ceilheinum) + ceilz) / U.ZSCALE;
  let currz2 = (slope(x2, y2, ceilheinum) + ceilz) / U.ZSCALE;
  let currz3 = (slope(x2, y2, floorheinum) + floorz) / U.ZSCALE;
  let currz4 = (slope(x1, y1, floorheinum) + floorz) / U.ZSCALE;
  let nextz1 = (nextslope(x1, y1, ceilnextheinum) + ceilnextz) / U.ZSCALE;
  let nextz2 = (nextslope(x2, y2, ceilnextheinum) + ceilnextz) / U.ZSCALE;
  let nextz3 = (nextslope(x2, y2, floornextheinum) + floornextz) / U.ZSCALE;
  let nextz4 = (nextslope(x1, y1, floornextheinum) + floornextz) / U.ZSCALE;
  let z1 = Math.min(currz1, nextz1);
  let z2 = Math.min(currz2, nextz2);
  let z3 = Math.max(currz3, nextz3);
  let z4 = Math.max(currz4, nextz4);
  return [x1, y1, z1, x2, y2, z2, x2, y2, z3, x1, y1, z4];
}

function normals(n: GLM.Vec3Array) {
  return [n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2], n[0], n[1], n[2]];
}

function writePos(buff: Buffer, c: number[]) {
  buff.writePos(0, c[0], c[2], c[1]);
  buff.writePos(1, c[3], c[5], c[4]);
  buff.writePos(2, c[6], c[8], c[7]);
  buff.writePos(3, c[9], c[11], c[10]);
}

function writeTransformTc(buff: Buffer, t: GLM.Mat4Array, c: number[]) {
  GLM.vec4.transformMat4(tc, GLM.vec4.set(tc, c[0], c[2], c[1], 1), t);
  buff.writeTc(0, tc[0], tc[1]);
  GLM.vec4.transformMat4(tc, GLM.vec4.set(tc, c[3], c[5], c[4], 1), t);
  buff.writeTc(1, tc[0], tc[1]);
  GLM.vec4.transformMat4(tc, GLM.vec4.set(tc, c[6], c[8], c[7], 1), t);
  buff.writeTc(2, tc[0], tc[1]);
  GLM.vec4.transformMat4(tc, GLM.vec4.set(tc, c[9], c[11], c[10], 1), t);
  buff.writeTc(3, tc[0], tc[1]);
}

function writeTc(buff: Buffer, t: number[]) {
  buff.writeTc(0, t[0], t[1]);
  buff.writeTc(1, t[2], t[3]);
  buff.writeTc(2, t[4], t[5]);
  buff.writeTc(3, t[6], t[7]);
}

function writeNormal(buff: Buffer, n: number[]) {
  buff.writeNormal(0, n[0], n[1], n[2]);
  buff.writeNormal(1, n[3], n[4], n[5]);
  buff.writeNormal(2, n[6], n[7], n[8]);
  buff.writeNormal(3, n[9], n[10], n[11]);
}

function genQuad(c: number[], n: number[], t: GLM.Mat4Array, buff: Buffer, onesided: number = 1) {
  buff.allocate(4, onesided ? 6 : 12);

  writePos(buff, c);
  writeTransformTc(buff, t, c);
  writeNormal(buff, n);

  buff.writeQuad(0, 0, 1, 2, 3);
  if (!onesided)
    buff.writeQuad(6, 3, 2, 1, 0);
}

function genSpriteQuad(x: number, y: number, z: number, n: number[], t: number[], buff: Buffer) {
  buff.allocate(4, 12);

  writePos(buff, [x, y, z, x, y, z, x, y, z, x, y, z]);
  writeTc(buff, t);
  writeNormal(buff, n);

  buff.writeQuad(0, 0, 1, 2, 3);
  buff.writeQuad(6, 3, 2, 1, 0);
}

function applyWallTextureTransform(wall: Wall, wall2: Wall, info: ArtInfo, base: number, originalWall: Wall = wall, texMat: GLM.Mat4Array) {
  let wall1 = wall;
  if (originalWall.cstat.xflip)
    [wall1, wall2] = [wall2, wall1];
  let flip = wall == originalWall ? 1 : -1;
  let tw = info.w;
  let th = info.h;
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let tcscalex = (wall.xrepeat * 8.0) / (flip * MU.len2d(dx, dy) * tw);
  let tcscaley = -(wall.yrepeat / 8.0) / (th * 16.0) * (originalWall.cstat.yflip ? -1 : 1);
  let tcxoff = wall.xpanning / tw;
  let tcyoff = wall.ypanning / 256.0;

  GLM.mat4.identity(texMat);
  GLM.mat4.translate(texMat, texMat, [tcxoff, tcyoff, 0, 0]);
  GLM.mat4.scale(texMat, texMat, [tcscalex, tcscaley, 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
  GLM.mat4.translate(texMat, texMat, [-wall1.x, -base / U.ZSCALE, -wall1.y, 0]);
}

let wallNormal = GLM.vec3.create();
export function updateWall(ctx: BuildContext, wallId: number, renderable: WallSolid): WallSolid {
  if (renderable == null) renderable = new WallSolid();
  let board = ctx.board;
  let art = ctx.art;
  let wall = board.walls[wallId];
  let sector = board.sectors[U.sectorOfWall(board, wallId)];
  let wall2 = board.walls[wall.point2];
  let x1 = wall.x; let y1 = wall.y;
  let x2 = wall2.x; let y2 = wall2.y;
  let tex = art.get(wall.picnum);
  let info = art.getInfo(wall.picnum);
  let slope = U.createSlopeCalculator(sector, board.walls);
  let ceilingheinum = sector.ceilingheinum;
  let ceilingz = sector.ceilingz;
  let floorheinum = sector.floorheinum;
  let floorz = sector.floorz;
  let trans = (wall.cstat.translucent || wall.cstat.translucentReversed) ? 0.6 : 1;
  let normal = normals(U.wallNormal(wallNormal, board, wallId));

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    let coords = getWallCoords(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    let base = wall.cstat.alignBottom ? floorz : ceilingz;
    applyWallTextureTransform(wall, wall2, info, base, wall, renderable.mid.texMat);
    genQuad(coords, normal, renderable.mid.texMat, renderable.mid.buff);
    renderable.mid.tex = tex;
    renderable.mid.shade = wall.shade;
    renderable.mid.pal = wall.pal;
  } else {
    let nextsector = board.sectors[wall.nextsector];
    let nextslope = U.createSlopeCalculator(nextsector, board.walls);
    let nextfloorz = nextsector.floorz;
    let nextceilingz = nextsector.ceilingz;

    let nextfloorheinum = nextsector.floorheinum;
    let floorcoords = getWallCoords(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true);
    if (floorcoords != null) {
      if (sector.floorstat.parallaxing && nextsector.floorstat.parallaxing && sector.floorpicnum == nextsector.floorpicnum) {
        renderable.bot.tex = art.getParallaxTexture(sector.floorpicnum);
        renderable.bot.shade = sector.floorshade;
        renderable.bot.pal = sector.floorpal;
        renderable.bot.parallax = 1;
      } else {
        let wall_ = wall.cstat.swapBottoms ? board.walls[wall.nextwall] : wall;
        let wall2_ = wall.cstat.swapBottoms ? board.walls[wall_.point2] : wall2;
        let tex_ = wall.cstat.swapBottoms ? art.get(wall_.picnum) : tex;
        let info_ = wall.cstat.swapBottoms ? art.getInfo(wall_.picnum) : info;
        let base = wall.cstat.alignBottom ? ceilingz : nextfloorz;
        applyWallTextureTransform(wall_, wall2_, info_, base, wall, renderable.bot.texMat);
        renderable.bot.tex = tex_;
        renderable.bot.shade = wall_.shade;
        renderable.bot.pal = wall_.pal;
      }
      genQuad(floorcoords, normal, renderable.bot.texMat, renderable.bot.buff);
    }

    let nextceilingheinum = nextsector.ceilingheinum;
    let ceilcoords = getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true);
    if (ceilcoords != null) {
      if (sector.ceilingstat.parallaxing && nextsector.ceilingstat.parallaxing && sector.ceilingpicnum == nextsector.ceilingpicnum) {
        renderable.top.tex = art.getParallaxTexture(sector.ceilingpicnum);
        renderable.top.shade = sector.ceilingshade;
        renderable.top.pal = sector.ceilingpal;
        renderable.top.parallax = 1;
      } else {
        let base = wall.cstat.alignBottom ? ceilingz : nextceilingz;
        applyWallTextureTransform(wall, wall2, info, base, wall, renderable.top.texMat);
        renderable.top.tex = tex;
        renderable.top.shade = wall.shade;
        renderable.top.pal = wall.pal;
      }
      genQuad(ceilcoords, normal, renderable.top.texMat, renderable.top.buff);
    }

    if (wall.cstat.masking) {
      let tex1 = art.get(wall.overpicnum);
      let info1 = art.getInfo(wall.overpicnum);
      let coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      let base = wall.cstat.alignBottom ? Math.min(floorz, nextfloorz) : Math.max(ceilingz, nextceilingz);
      applyWallTextureTransform(wall, wall2, info1, base, wall, renderable.mid.texMat);
      genQuad(coords, normal, renderable.mid.texMat, renderable.mid.buff);
      renderable.mid.tex = tex1;
      renderable.mid.shade = wall.shade;
      renderable.mid.pal = wall.pal;
      renderable.mid.trans = trans;
    }
  }
  return renderable;
}

function fillbuffersForWallSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number, onesided: number, renderable: Solid) {
  let dx = Math.sin(ang) * hw;
  let dy = Math.cos(ang) * hw;

  let xs = xf ? -1.0 : 1.0;
  let ys = yf ? -1.0 : 1.0;
  let texMat = renderable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xs / (hw * 2), -ys / (hh * 2), 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -ang - Math.PI / 2);
  GLM.mat4.translate(texMat, texMat, [-x - xs * dx, -z - ys * hh - yo, -y - xs * dy, 0]);

  genQuad([
    x - dx, y - dy, z - hh + yo,
    x + dx, y + dy, z - hh + yo,
    x + dx, y + dy, z + hh + yo,
    x - dx, y - dy, z + hh + yo],
    normals(U.ang2vec(ang)), texMat,
    renderable.buff, onesided);

}

function fillbuffersForFloorSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number, onesided: number, renderable: Solid) {
  let dwx = Math.sin(ang) * hw;
  let dwy = Math.cos(ang) * hw;
  let dhx = Math.sin(ang + Math.PI / 2) * hh;
  let dhy = Math.cos(ang + Math.PI / 2) * hh;
  let s = !(xf || yf) ? 1 : -1;

  let xs = xf ? -1.0 : 1.0;
  let ys = yf ? -1.0 : 1.0;
  let texMat = renderable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xs / (hw * 2), ys / (hh * 2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw, hh, 0, 0]);
  GLM.mat4.rotateZ(texMat, texMat, ang - Math.PI / 2);
  GLM.mat4.translate(texMat, texMat, [-x, -y, 0, 0]);
  GLM.mat4.rotateX(texMat, texMat, -Math.PI / 2);

  genQuad([
    x - dwx - dhx, y - dwy - dhy, z,
    x + s * (-dwx + dhx), y + s * (-dwy + dhy), z,
    x + dwx + dhx, y + dwy + dhy, z,
    x + s * (dwx - dhx), y + s * (dwy - dhy), z],
    normals([0, s, 0]), texMat,
    renderable.buff, onesided);

}

function fillBuffersForFaceSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, xf: number, yf: number, renderable: Solid) {
  let texMat = renderable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [1 / (hw * 2), -1 / (hh * 2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw - xo, -hh - yo, 0, 0]);

  genSpriteQuad(x, y, z, [
    -hw + xo, +hh + yo, 0,
    +hw + xo, +hh + yo, 0,
    +hw + xo, -hh + yo, 0,
    -hw + xo, -hh + yo, 0
  ], [0, 0, 1, 0, 1, 1, 0, 1], renderable.buff);
}

export function updateSprite(ctx: BuildContext, sprId: number, renderable: Solid): Solid {
  if (renderable == null) renderable = new Solid();
  let spr = ctx.board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible)
    return renderable;

  let x = spr.x; let y = spr.y; let z = spr.z / U.ZSCALE;
  let info = ctx.art.getInfo(spr.picnum);
  let tex = ctx.art.get(spr.picnum);
  let w = (info.w * spr.xrepeat) / 4; let hw = w >> 1;
  let h = (info.h * spr.yrepeat) / 4; let hh = h >> 1;
  let ang = U.spriteAngle(spr.ang);
  let xo = (info.attrs.xoff * spr.xrepeat) / 4;
  let yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);
  let xf = spr.cstat.xflip; let yf = spr.cstat.yflip;
  let sec = ctx.board.sectors[spr.sectnum];
  let sectorShade = sec.floorshade;
  let shade = spr.shade == -8 ? sectorShade : spr.shade;
  let trans = (spr.cstat.translucent || spr.cstat.tranclucentReversed) ? 0.6 : 1;
  renderable.tex = tex;
  renderable.shade = shade;
  renderable.pal = spr.pal;
  renderable.trans = trans;

  if (spr.cstat.type == FACE) {
    fillBuffersForFaceSprite(x, y, z, xo, yo, hw, hh, xf, yf, renderable);
    renderable.type = Type.FACE;
  } else if (spr.cstat.type == WALL) {
    fillbuffersForWallSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, renderable);
  } else if (spr.cstat.type == FLOOR) {
    fillbuffersForFloorSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, renderable);
  }

  return renderable;
}