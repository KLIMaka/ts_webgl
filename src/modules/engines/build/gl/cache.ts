import { Solid, Wireframe, Buffer, Type, Renderable } from './renderable';
import { ArtInfo, ArtInfoProvider } from '../art';
import { Board, Sector, Wall, FACE, WALL, FLOOR } from '../structs';
import { tesselate } from '../../../../libs_js/glutess';
import { Texture } from '../../../drawstruct';
import * as U from '../utils';
import * as GLM from '../../../../libs_js/glmatrix';
import * as MU from '../../../../libs/mathutils';
import { State } from '../../../stategl';

class EnsureArray<T> {
  private array: Array<T> = [];
  constructor(private factory: () => T) { }

  public get(id: number): T {
    let ent = this.array[id];
    if (ent == undefined) {
      ent = this.factory();
      this.array[id] = ent;
    }
    return ent;
  }

  public map(f: (arg: T) => void) {
    this.array.map(f);
  }
}
function createArray<T>(factory: () => T): EnsureArray<T> {
  return new EnsureArray<T>(factory);
}

export interface ArtProvider extends ArtInfoProvider {
  get(picnum: number): Texture;
  getParallaxTexture(picnum: number): Texture
}

class SectorSolid implements Renderable {
  public ceiling: Solid = new Solid();
  public floor: Solid = new Solid();

  draw(gl: WebGLRenderingContext, state: State) {
    this.ceiling.draw(gl, state);
    this.floor.draw(gl, state);
  }
}

class WallSolid implements Renderable {
  public top: Solid = new Solid();
  public mid: Solid = new Solid();
  public bot: Solid = new Solid();

  draw(gl: WebGLRenderingContext, state: State) {
    this.top.draw(gl, state);
    this.mid.draw(gl, state);
    this.bot.draw(gl, state);
  }
}

class SpriteSolid extends Solid { }

class SectorWireframe {
  public ceiling: Wireframe = new Wireframe();
  public floor: Wireframe = new Wireframe();
}

class WallWireframe {
  public top: Wireframe = new Wireframe();
  public mid: Wireframe = new Wireframe();
  public bot: Wireframe = new Wireframe();
}

class SpriteWireframe extends Wireframe { }


class Entry<T> {
  constructor(public value: T, public valid: boolean = false) { }
}

let sectorRenerableFactory = () => new Entry<SectorSolid>(new SectorSolid());
let wallRenerableFactory = () => new Entry<WallSolid>(new WallSolid());
let spriteRenerableFactory = () => new Entry<SpriteSolid>(new SpriteSolid());
let wireframeFactory = () => new Entry<Wireframe>(new Wireframe());
let sectorWireframeFactory = () => new Entry<SectorWireframe>(new SectorWireframe());
let wallWireframeFactory = () => new Entry<WallWireframe>(new WallWireframe());
let spriteWireframeFactory = () => new Entry<SpriteWireframe>(new SpriteWireframe());

export class Cache {
  public sectors: EnsureArray<Entry<SectorSolid>> = createArray(sectorRenerableFactory);
  public walls: EnsureArray<Entry<WallSolid>> = createArray(wallRenerableFactory);
  public sprites: EnsureArray<Entry<SpriteSolid>> = createArray(spriteRenerableFactory);
  public wallCeilPoints: EnsureArray<Entry<Wireframe>> = createArray(wireframeFactory);
  public wallFloorPoints: EnsureArray<Entry<Wireframe>> = createArray(wireframeFactory);
  public sectorsWireframe: EnsureArray<Entry<SectorWireframe>> = createArray(sectorWireframeFactory);
  public wallsWireframe: EnsureArray<Entry<WallWireframe>> = createArray(wallWireframeFactory);
  public spritesWireframe: EnsureArray<Entry<SpriteWireframe>> = createArray(spriteWireframeFactory);

  constructor(private board: Board, private art: ArtProvider) {
  }

  public getSector(secId: number): SectorSolid {
    let sector = this.sectors.get(secId);
    if (!sector.valid) {
      prepareSector(this.board, this.art, secId, sector.value);
      sector.valid = true;
    }
    return sector.value;
  }

  public getWall(wallId: number, sectorId: number): WallSolid {
    let wall = this.walls.get(wallId);
    if (!wall.valid) {
      prepareWall(this.board, this.art, wallId, sectorId, wall.value);
      wall.valid = true;
    }
    return wall.value;
  }

  public getSprite(spriteId: number): SpriteSolid {
    let sprite = this.sprites.get(spriteId);
    if (!sprite.valid) {
      prepareSprite(this.board, this.art, spriteId, sprite.value);
      sprite.valid = true;
    }
    return sprite.value;
  }

  public getSectorWireframe(secId: number): SectorWireframe {
    let sectorWireframe = this.sectorsWireframe.get(secId);
    if (!sectorWireframe.valid) {
      prepareSectorWireframe(this.board, secId, sectorWireframe.value);
      sectorWireframe.valid = true;
    }
    return sectorWireframe.value;
  }

  public getWallWireframe(wallId: number, secId: number): WallWireframe {
    let wallWireframe = this.wallsWireframe.get(wallId);
    if (!wallWireframe.valid) {
      prepareWallWireframe(this.board, wallId, secId, wallWireframe.value);
      wallWireframe.valid = true;
    }
    return wallWireframe.value;
  }

  public getSpriteWireframe(sprId: number): SpriteWireframe {
    let spriteWireframe = this.spritesWireframe.get(sprId);
    if (!spriteWireframe.valid) {
      prepareSpriteWireframe(this.board, sprId, this.art, spriteWireframe.value);
      spriteWireframe.valid = true;
    }
    return spriteWireframe.value;
  }

  public getWallPoint(id: number, d: number, ceiling: boolean): Wireframe {
    let point = (ceiling ? this.wallCeilPoints : this.wallFloorPoints).get(id);
    if (!point.valid) {
      prepareWallPoint(this.board, ceiling, id, d, point.value);
      point.valid = true;
    }
    return point.value;
  }

  public invalidateSector(id: number) {
    let sec = this.sectors.get(id);
    sec.valid = false;
    sec.value.ceiling.reset();
    sec.value.floor.reset();
    let secw = this.sectorsWireframe.get(id);
    secw.valid = false;
    secw.value.ceiling.buff.deallocate();
    secw.value.floor.buff.deallocate();
  }

  public invalidateWall(id: number) {
    let wall = this.walls.get(id);
    wall.valid = false;
    wall.value.bot.reset();
    wall.value.mid.reset();
    wall.value.top.reset();
    let wallw = this.wallsWireframe.get(id);
    wallw.valid = false;
    wallw.value.bot.buff.deallocate();
    wallw.value.mid.buff.deallocate();
    wallw.value.top.buff.deallocate();
    this.wallCeilPoints.get(id).valid = false;
    this.wallFloorPoints.get(id).valid = false;
  }

  public invalidateSprite(id: number) {
    this.sprites.get(id).valid = false;
    this.spritesWireframe.get(id).valid = false;
  }

  public invalidateAll() {
    this.sectors.map(s => { if (s != undefined) { s.valid = false; s.value.ceiling.reset(); s.value.floor.reset(); } });
    this.walls.map(w => { if (w != undefined) { w.valid = false; w.value.bot.reset(); w.value.mid.reset(); w.value.top.reset(); } });
    this.sprites.map(s => { if (s != undefined) { s.valid = false; s.value.reset(); } });
    this.wallCeilPoints.map(s => { if (s != undefined) { s.valid = false; s.value.buff.deallocate(); } });
    this.wallFloorPoints.map(s => { if (s != undefined) { s.valid = false; s.value.buff.deallocate(); } });
  }

  public getByIdType(id: number, addId: number, type: U.Type, wireframe: boolean = false): Renderable {
    switch (type) {
      case U.Type.CEILING:
        return wireframe ? this.getSectorWireframe(id).ceiling : this.getSector(id).ceiling;
      case U.Type.FLOOR:
        return wireframe ? this.getSectorWireframe(id).floor : this.getSector(id).floor;
      case U.Type.LOWER_WALL:
        return wireframe ? this.getWallWireframe(id, addId).bot : this.getWall(id, addId).bot;
      case U.Type.MID_WALL:
        return wireframe ? this.getWallWireframe(id, addId).mid : this.getWall(id, addId).mid;
      case U.Type.UPPER_WALL:
        return wireframe ? this.getWallWireframe(id, addId).top : this.getWall(id, addId).top;
      case U.Type.SPRITE:
        return wireframe ? this.getSpriteWireframe(id) : this.getSprite(id);
    }
    return null;
  }
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

function prepareWallPoint(board: Board, ceiling: boolean, wallId: number, d: number, point: Wireframe) {
  point.mode = WebGLRenderingContext.TRIANGLES;
  let s = U.sectorOfWall(board, wallId);
  let sec = board.sectors[s];
  let slope = U.createSlopeCalculator(sec, board.walls);
  let h = (ceiling ? sec.ceilingheinum : sec.floorheinum);
  let z = (ceiling ? sec.ceilingz : sec.floorz);
  let wall = board.walls[wallId];
  let zz = (slope(wall.x, wall.y, h) + z) / U.ZSCALE;
  fillBufferForWallPoint(board, wallId, point.buff, d, zz);
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

function prepareSectorWireframe(board: Board, secId: number, wireframe: SectorWireframe) {
  let sec = board.sectors[secId];
  fillBuffersForSectorWireframe(sec, sec.ceilingheinum, sec.ceilingz, board, wireframe.ceiling.buff);
  fillBuffersForSectorWireframe(sec, sec.floorheinum, sec.floorz, board, wireframe.floor.buff);
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

function prepareWallWireframe(board: Board, wallId: number, secId: number, wireframe: WallWireframe) {
  let wall = board.walls[wallId];
  let sector = board.sectors[secId];
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
    genQuadWireframe(coords, null, wireframe.mid.buff);
  } else {
    let nextsector = board.sectors[wall.nextsector];
    let nextslope = U.createSlopeCalculator(nextsector, board.walls);
    let nextfloorz = nextsector.floorz;
    let nextceilingz = nextsector.ceilingz;

    let nextfloorheinum = nextsector.floorheinum;
    let botcoords = getWallCoords(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true);
    if (botcoords != null) {
      genQuadWireframe(botcoords, null, wireframe.bot.buff);
    }

    let nextceilingheinum = nextsector.ceilingheinum;
    let topcoords = getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true);
    if (topcoords != null) {
      genQuadWireframe(topcoords, null, wireframe.top.buff);
    }

    if (wall.cstat.masking) {
      let coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      genQuadWireframe(coords, null, wireframe.mid.buff);
    }
  }
}

function fillbuffersForWallSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, renderable: SpriteWireframe) {
  let dx = Math.sin(ang) * hw;
  let dy = Math.cos(ang) * hw;
  genQuadWireframe([
    x - dx, y - dy, z - hh + yo,
    x + dx, y + dy, z - hh + yo,
    x + dx, y + dy, z + hh + yo,
    x - dx, y - dy, z + hh + yo],
    null, renderable.buff);
}

function fillbuffersForFloorSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, renderable: SpriteWireframe) {
  let dwx = Math.sin(-ang) * hw;
  let dwy = Math.cos(-ang) * hw;
  let dhx = Math.sin(-ang + Math.PI / 2) * hh;
  let dhy = Math.cos(-ang + Math.PI / 2) * hh;
  genQuadWireframe([
    x - dwx - dhx, y - dwy - dhy, z,
    x + dwx - dhx, y + dwy - dhy, z,
    x + dwx + dhx, y + dwy + dhy, z,
    x - dwx + dhx, y - dwy + dhy, z],
    null, renderable.buff);
}

function fillBuffersForFaceSpriteWireframe(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, renderable: SpriteWireframe) {
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


function prepareSpriteWireframe(board: Board, sprId: number, art: ArtProvider, wireframe: SpriteWireframe) {
  let spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invicible)
    return;

  let x = spr.x; let y = spr.y; let z = spr.z / U.ZSCALE;
  let info = art.getInfo(spr.picnum);
  let w = (info.w * spr.xrepeat) / 4; let hw = w >> 1;
  let h = (info.h * spr.yrepeat) / 4; let hh = h >> 1;
  let ang = MU.PI2 - (spr.ang / 2048) * MU.PI2;
  let xo = (info.attrs.xoff * spr.xrepeat) / 4;
  let yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);

  if (spr.cstat.type == FACE) {
    fillBuffersForFaceSpriteWireframe(x, y, z, xo, yo, hw, hh, wireframe);
    wireframe.type = Type.FACE;
  } else if (spr.cstat.type == WALL) {
    fillbuffersForWallSpriteWireframe(x, y, z, xo, yo, hw, hh, ang, wireframe);
  } else if (spr.cstat.type == FLOOR) {
    fillbuffersForFloorSpriteWireframe(x, y, z, xo, yo, hw, hh, ang, wireframe);
  }
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

function fillBuffersForSectorNormal(ceil: boolean, board: Board, sec: Sector, buff: Buffer, vtxs: number[][], vidxs: number[], normal: GLM.Vec3Array) {
  let heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  let z = ceil ? sec.ceilingz : sec.floorz;
  let slope = U.createSlopeCalculator(sec, board.walls);

  for (let i = 0; i < vtxs.length; i++) {
    let vx = vtxs[i][0];
    let vy = vtxs[i][1];
    let vz = (slope(vx, vy, heinum) + z) / U.ZSCALE;
    buff.writePos(i, vx, vz, vy);
    buff.writeNormal(i, normal[0], normal[1], normal[2]);
  }

  for (let i = 0; i < vidxs.length; i += 3) {
    if (ceil) {
      buff.writeTriangle(i, vidxs[i + 0], vidxs[i + 1], vidxs[i + 2]);
    } else {
      buff.writeTriangle(i, vidxs[i + 2], vidxs[i + 1], vidxs[i + 0]);
    }
  }
}

function fillBuffersForSector(ceil: boolean, board: Board, sec: Sector, renderable: SectorSolid, normal: GLM.Vec3Array) {
  let [vtxs, vidxs] = cacheTriangulate(board, sec);
  let d = ceil ? renderable.ceiling : renderable.floor;
  d.buff.allocate(vtxs.length, vidxs.length);
  fillBuffersForSectorNormal(ceil, board, sec, d.buff, vtxs, vidxs, normal);
}

let sectorNorlam = GLM.vec3.create();
function prepareSector(board: Board, art: ArtProvider, secId: number, renderable: SectorSolid) {
  let sec = board.sectors[secId];
  fillBuffersForSector(true, board, sec, renderable, U.sectorNormal(sectorNorlam, board, secId, true));
  renderable.ceiling.tex = sec.ceilingstat.parallaxing ? art.getParallaxTexture(sec.ceilingpicnum) : art.get(sec.ceilingpicnum);
  renderable.ceiling.parallax = sec.ceilingstat.parallaxing;
  renderable.ceiling.pal = sec.ceilingpal;
  renderable.ceiling.shade = sec.ceilingshade;
  let ceilinginfo = art.getInfo(sec.ceilingpicnum);
  applySectorTextureTransform(sec, true, board.walls, ceilinginfo, renderable.ceiling.texMat);

  fillBuffersForSector(false, board, sec, renderable, U.sectorNormal(sectorNorlam, board, secId, false));
  renderable.floor.tex = sec.floorstat.parallaxing ? art.getParallaxTexture(sec.floorpicnum) : art.get(sec.floorpicnum);
  renderable.floor.parallax = sec.floorstat.parallaxing;
  renderable.floor.pal = sec.floorpal;
  renderable.floor.shade = sec.floorshade;
  let floorinfo = art.getInfo(sec.floorpicnum);
  applySectorTextureTransform(sec, false, board.walls, floorinfo, renderable.floor.texMat);
}

function getWallCoords(x1: number, y1: number, x2: number, y2: number,
  slope: any, nextslope: any, heinum: number, nextheinum: number, z: number, nextz: number, check: boolean): number[] {
  let z1 = (slope(x1, y1, heinum) + z) / U.ZSCALE;
  let z2 = (slope(x2, y2, heinum) + z) / U.ZSCALE;
  let z3 = (nextslope(x2, y2, nextheinum) + nextz) / U.ZSCALE;
  let z4 = (nextslope(x1, y1, nextheinum) + nextz) / U.ZSCALE;
  if (check && (z4 >= z1 && z3 >= z2))
    return null;
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

function genQuad(coords: number[], n: number[], buff: Buffer, onesided: number = 1) {
  buff.allocate(4, onesided ? 6 : 12);
  let [x1, y1, z1, x2, y2, z2, x3, y3, z3, x4, y4, z4] = coords;
  buff.writePos(0, x1, z1, y1);
  buff.writePos(1, x2, z2, y2);
  buff.writePos(2, x3, z3, y3);
  buff.writePos(3, x4, z4, y4);
  buff.writeNormal(0, n[0], n[1], n[2]);
  buff.writeNormal(1, n[3], n[4], n[5]);
  buff.writeNormal(2, n[6], n[7], n[8]);
  buff.writeNormal(3, n[9], n[10], n[11]);
  buff.writeQuad(0, 0, 1, 2, 3);
  if (!onesided)
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
  let tcscalex = (originalWall.xrepeat * 8.0) / (flip * MU.len2d(dx, dy) * tw);
  let tcscaley = -(wall.yrepeat / 8.0) / (th * 16.0);
  let tcxoff = originalWall.xpanning / tw;
  let tcyoff = wall.ypanning / 256.0;

  GLM.mat4.identity(texMat);
  GLM.mat4.translate(texMat, texMat, [tcxoff, tcyoff, 0, 0]);
  GLM.mat4.scale(texMat, texMat, [tcscalex, tcscaley, 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
  GLM.mat4.translate(texMat, texMat, [-wall1.x, -base / U.ZSCALE, -wall1.y, 0]);
}

let wallNormal = GLM.vec3.create();
function prepareWall(board: Board, art: ArtProvider, wallId: number, secId: number, renderable: WallSolid) {
  let wall = board.walls[wallId];
  let sector = board.sectors[secId];
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
    genQuad(coords, normal, renderable.mid.buff);
    let base = wall.cstat.alignBottom ? floorz : ceilingz;
    applyWallTextureTransform(wall, wall2, info, base, wall, renderable.mid.texMat);
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
      genQuad(floorcoords, normal, renderable.bot.buff);
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
    }

    let nextceilingheinum = nextsector.ceilingheinum;
    let ceilcoords = getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true);
    if (ceilcoords != null) {
      genQuad(ceilcoords, normal, renderable.top.buff);
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
    }

    if (wall.cstat.masking) {
      let tex1 = art.get(wall.overpicnum);
      let info1 = art.getInfo(wall.overpicnum);
      let coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      genQuad(coords, normal, renderable.mid.buff);
      let base = wall.cstat.alignBottom ? Math.min(floorz, nextfloorz) : Math.max(ceilingz, nextceilingz);
      applyWallTextureTransform(wall, wall2, info1, base, wall, renderable.mid.texMat);
      renderable.mid.tex = tex1;
      renderable.mid.shade = wall.shade;
      renderable.mid.pal = wall.pal;
      renderable.mid.trans = trans;
    }
  }
}

function fillbuffersForWallSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number, onesided: number, renderable: SpriteSolid) {
  let dx = Math.sin(ang) * hw;
  let dy = Math.cos(ang) * hw;
  genQuad([
    x - dx, y - dy, z - hh + yo,
    x + dx, y + dy, z - hh + yo,
    x + dx, y + dy, z + hh + yo,
    x - dx, y - dy, z + hh + yo],
    normals(U.ang2vec(ang)),
    renderable.buff, onesided);

  let xs = xf ? -1.0 : 1.0;
  let ys = yf ? -1.0 : 1.0;
  let texMat = renderable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xs / (hw * 2), -ys / (hh * 2), 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -ang - Math.PI / 2);
  GLM.mat4.translate(texMat, texMat, [-x - xs * dx, -z - ys * hh - yo, -y - xs * dy, 0]);
}

function fillbuffersForFloorSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, ang: number, xf: number, yf: number, onesided: number, renderable: SpriteSolid) {
  let dwx = Math.sin(-ang) * hw;
  let dwy = Math.cos(-ang) * hw;
  let dhx = Math.sin(-ang + Math.PI / 2) * hh;
  let dhy = Math.cos(-ang + Math.PI / 2) * hh;
  let s = !(xf || yf) ? 1 : -1;
  genQuad([
    x - dwx - dhx, y - dwy - dhy, z,
    x + s * (-dwx + dhx), y + s * (-dwy + dhy), z,
    x + dwx + dhx, y + dwy + dhy, z,
    x + s * (dwx - dhx), y + s * (dwy - dhy), z],
    normals([0, s, 0]),
    renderable.buff, onesided);

  let xs = xf ? -1.0 : 1.0;
  let ys = yf ? -1.0 : 1.0;
  let texMat = renderable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xs / (hw * 2), ys / (hh * 2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw, hh, 0, 0]);
  GLM.mat4.rotateZ(texMat, texMat, ang - Math.PI / 2);
  GLM.mat4.translate(texMat, texMat, [-x, -y, 0, 0]);
  GLM.mat4.rotateX(texMat, texMat, -Math.PI / 2);
}

function fillBuffersForFaceSprite(x: number, y: number, z: number, xo: number, yo: number, hw: number, hh: number, xf: number, yf: number, renderable: SpriteSolid) {
  genQuad([
    x, y, z,
    x, y, z,
    x, y, z,
    x, y, z
  ], [
      -hw + xo, +hh + yo, 0,
      +hw + xo, +hh + yo, 0,
      +hw + xo, -hh + yo, 0,
      -hw + xo, -hh + yo, 0
    ], renderable.buff, 0);

  let texMat = renderable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [1 / (hw * 2), -1 / (hh * 2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw - xo, -hh - yo, 0, 0]);
}

function prepareSprite(board: Board, art: ArtProvider, sprId: number, renderable: SpriteSolid) {
  let spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invicible)
    return;

  let x = spr.x; let y = spr.y; let z = spr.z / U.ZSCALE;
  let info = art.getInfo(spr.picnum);
  let tex = art.get(spr.picnum);
  let w = (info.w * spr.xrepeat) / 4; let hw = w >> 1;
  let h = (info.h * spr.yrepeat) / 4; let hh = h >> 1;
  let ang = MU.PI2 - (spr.ang / 2048) * MU.PI2;
  let xo = (info.attrs.xoff * spr.xrepeat) / 4;
  let yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);
  let xf = spr.cstat.xflip; let yf = spr.cstat.yflip;
  let sec = board.sectors[spr.sectnum];
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
}