import {Drawable, Buffer, Type} from './drawable';
import {ArtInfo, ArtInfoProvider} from '../art';
import {Board, Sector, Sprite, Wall, FACE, WALL, FLOOR} from '../structs';
import {tesselate} from '../../../../libs_js/glutess';
import {Texture} from '../../../drawstruct';
import * as U from '../utils';
import * as GLM from '../../../../libs_js/glmatrix';
import * as MU from '../../../../libs/mathutils';

const SCALE = -16;

export interface ArtProvider extends ArtInfoProvider {
  get(picnum:number):Texture;
}

export class SectorDrawable {
  public ceiling:Drawable = new Drawable();
  public floor:Drawable = new Drawable();
}

export class WallDrawable {
  public top:Drawable = new Drawable();
  public mid:Drawable = new Drawable();
  public bot:Drawable = new Drawable();
}

export class SpriteDrawable extends Drawable {}

class Entry<T> {
  constructor(public value:T, public valid:boolean=false) {}
}

export class Cache {
  public sectors:Entry<SectorDrawable>[] = [];
  public walls:Entry<WallDrawable>[] = [];
  public sprites:Entry<SpriteDrawable>[] = [];

  constructor(private board:Board, private art:ArtProvider) {}

  private ensure<T>(dir:Entry<T>[], id:number, create:()=>T) {
    var ent = dir[id];
    if (ent == undefined) {
      ent = new Entry<T>(create());
      dir[id] = ent;
    }
    return ent;
  }

  public getSector(id:number):SectorDrawable {
    var sector = this.ensure(this.sectors, id, () => new SectorDrawable());
    if (!sector.valid)
      prepareSector(this.board, this.art, id, sector.value);
    return sector.value;
  }

  public getWall(wallId:number, sectorId:number):WallDrawable {
    var wall = this.ensure(this.walls, wallId, () => new WallDrawable());
    if (!wall.valid)
      prepareWall(this.board, this.art, wallId, sectorId, wall.value);
    return wall.value;
  }

  public getSprite(spriteId:number):SpriteDrawable {
    var sprite = this.ensure(this.sprites, spriteId, () => new SpriteDrawable());
    if (!sprite.valid)
      prepareSprite(this.board, this.art, spriteId, sprite.value);
    return sprite.value;
  }

  public invalidateSectors(ids:number[]) {
    ids.map((id) => this.ensure(this.sectors, ids[id], () => new SectorDrawable()).valid = false);
  }

  public invalidateWalls(ids:number[]) {
    ids.map((id) => this.ensure(this.walls, ids[id], () => new WallDrawable()).valid = false);
  }

  public invalidateSprites(ids:number[]) {
    ids.map((id) => this.ensure(this.sprites, ids[id], () => new SpriteDrawable()).valid = false);
  }
}

function applySectorTextureTransform(sector:Sector, ceiling:boolean, walls:Wall[], info:ArtInfo, texMat:GLM.Mat4Array) {
  var xpan = ceiling ? sector.ceilingxpanning : sector.floorxpanning;
  var ypan = ceiling ? sector.ceilingypanning : sector.floorypanning;
  var stats = ceiling ? sector.ceilingstat : sector.floorstat;
  var scale = stats.doubleSmooshiness ? 8.0 : 16.0;
  var tcscalex = (stats.xflip ? -1.0 :  1.0) / (info.w * scale);
  var tcscaley = (stats.yflip ? -1.0 :  1.0) / (info.h * scale);
  GLM.mat4.identity(texMat);
  GLM.mat4.translate(texMat, texMat, [xpan / 256.0, ypan / 256.0, 0, 0]);
  GLM.mat4.scale(texMat, texMat, [tcscalex, tcscaley, 1, 1]);
  if (stats.swapXY) {
    GLM.mat4.rotateZ(texMat, texMat, -Math.PI/2);
    GLM.mat4.scale(texMat, texMat, [-1, 1, 1, 1]);
  }
  if (stats.alignToFirstWall) {
    var w1 = walls[sector.wallptr];
    GLM.mat4.rotateZ(texMat, texMat, U.getFirstWallAngle(sector, walls));
    GLM.mat4.translate(texMat, texMat, [-w1.x, -w1.y, 0, 0])
  }
  GLM.mat4.rotateX(texMat, texMat, -Math.PI/2);
}

function triangulate(sector:Sector, walls:Wall[]):number[][] {
  var contour = [];
  var contours = [];
  var fw = sector.wallptr;
  for (var w = 0; w < sector.wallnum; w++) {
    var wid = sector.wallptr + w;
    var wall = walls[wid];
    contour.push(wall.x, wall.y);
    if (wall.point2 == fw) {
      contours.push(contour);
      contour = [];
      fw = wid + 1;
    }
  }
  return tesselate(contours);
}

var tricache = {};
function cacheTriangulate(board:Board, sec:Sector) {
  var res = tricache[sec.wallptr];
  if (res == undefined) {
    res = triangulate(sec, board.walls);
    tricache[sec.wallptr] = res;
  }
  return res;
}

function fillBuffersForSectorWireframe(ceil:boolean, board:Board, sec:Sector, voff:number, buff:Buffer) {
  var heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  var z = ceil ? sec.ceilingz : sec.floorz;
  var slope = U.createSlopeCalculator(sec, board.walls);

  var fw = sec.wallptr;
  var baseIdx = voff;
  var off = 0;
  for (var w = 0; w < sec.wallnum; w++) {
    var wid = sec.wallptr + w;
    var wall = board.walls[wid];
    var vx = wall.x;
    var vy = wall.y;
    var vz = (slope(vx, vy, heinum) + z) / SCALE;
    voff = buff.writePos(voff, vx, vz, vy);
    if (fw != wid) {
      off = buff.writeLine(off, baseIdx+w-1, baseIdx+w);
    }
    if (wall.point2 == fw) {
      off = buff.writeLine(off, baseIdx+w, baseIdx+fw-sec.wallptr);
      fw = wid + 1;
    } 
  }
}

function fillBuffersForSectorNormal(ceil:boolean, board:Board, sec:Sector, buff:Buffer, vtxs:number[][], vidxs:number[]) {
  var heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  var z = ceil ? sec.ceilingz : sec.floorz;
  var slope = U.createSlopeCalculator(sec, board.walls);

  var off = 0;
  for (var i = 0; i < vtxs.length; i++) {
    var vx = vtxs[i][0];
    var vy = vtxs[i][1];
    var vz = (slope(vx, vy, heinum) + z) / SCALE;
    off = buff.writePos(off, vx, vz, vy);
  }

  off = 0;
  for (var i = 0; i < vidxs.length; i+=3) {
    if (ceil) {
      off = buff.writeTriangle(off, vidxs[i+0], vidxs[i+1], vidxs[i+2]);
    } else {
      off = buff.writeTriangle(off, vidxs[i+2], vidxs[i+1], vidxs[i+0]);
    }
  }
}

function fillBuffersForSector(ceil:boolean, board:Board, sec:Sector, drawable:SectorDrawable) {
    var [vtxs, vidxs] = cacheTriangulate(board, sec);
    var d = ceil ? drawable.ceiling : drawable.floor;
    d.buff.allocate(vtxs.length+sec.wallnum, vidxs.length, sec.wallnum*2);
    fillBuffersForSectorNormal(ceil, board, sec, d.buff, vtxs, vidxs);
    fillBuffersForSectorWireframe(ceil, board, sec, vtxs.length, d.buff);
}

function prepareSector(board:Board, art:ArtProvider, secId:number, drawable:SectorDrawable) {
  var sec = board.sectors[secId];
  fillBuffersForSector(true, board, sec, drawable);
  drawable.ceiling.tex = art.get(sec.ceilingpicnum);
  drawable.ceiling.pal = sec.ceilingpal;
  drawable.ceiling.shade = sec.ceilingshade;
  var info = art.getInfo(sec.ceilingpicnum);
  applySectorTextureTransform(sec, true, board.walls, info, drawable.ceiling.texMat);

  fillBuffersForSector(false, board, sec, drawable);
  drawable.floor.tex = art.get(sec.floorpicnum);
  drawable.floor.pal = sec.floorpal;
  drawable.floor.shade = sec.floorshade;
  var info = art.getInfo(sec.floorpicnum);
  applySectorTextureTransform(sec, false, board.walls, info, drawable.floor.texMat);
}

function fillBuffersForWall(x1:number, y1:number, x2:number, y2:number, 
  slope:any, nextslope:any, heinum:number, nextheinum:number, z:number, nextz:number, check:boolean, buff:Buffer):boolean {
  var z1 = (slope(x1, y1, heinum) + z) / SCALE; 
  var z2 = (slope(x2, y2, heinum) + z) / SCALE;
  var z3 = (nextslope(x2, y2, nextheinum) + nextz) / SCALE;
  var z4 = (nextslope(x1, y1, nextheinum) + nextz) / SCALE;
  if (check && (z4 >= z1 && z3 >= z2))
    return false;
  buff.allocate(4, 6, 8);
  genWallQuad(x1, y1, x2, y2, z1, z2, z3, z4, buff);
  return true;
}

function fillBuffersForMaskedWall(x1:number, y1:number, x2:number, y2:number, slope:any, nextslope:any, 
  ceilheinum:number, ceilnextheinum:number, ceilz:number, ceilnextz:number,
  floorheinum:number, floornextheinum:number, floorz:number, floornextz:number, buff:Buffer):void {
  var currz1 = (slope(x1, y1, ceilheinum) + ceilz) / SCALE; 
  var currz2 = (slope(x2, y2, ceilheinum) + ceilz) / SCALE;
  var currz3 = (slope(x2, y2, floorheinum) + floorz) / SCALE;
  var currz4 = (slope(x1, y1, floorheinum) + floorz) / SCALE;
  var nextz1 = (nextslope(x1, y1, ceilnextheinum) + ceilnextz) / SCALE; 
  var nextz2 = (nextslope(x2, y2, ceilnextheinum) + ceilnextz) / SCALE;
  var nextz3 = (nextslope(x2, y2, floornextheinum) + floornextz) / SCALE;
  var nextz4 = (nextslope(x1, y1, floornextheinum) + floornextz) / SCALE;
  var z1 = Math.min(currz1, nextz1);
  var z2 = Math.min(currz2, nextz2);
  var z3 = Math.max(currz3, nextz3);
  var z4 = Math.max(currz4, nextz4);
  buff.allocate(4, 6, 8);
  genWallQuad(x1, y1, x2, y2, z1, z2, z3, z4, buff);
}

function genWallQuad(x1:number, y1:number, x2:number, y2:number, z1:number, z2:number, z3:number, z4:number, buff:Buffer) {
  var off = 0;
  off = buff.writePos(off, x1, z1, y1);
  off = buff.writePos(off, x2, z2, y2);
  off = buff.writePos(off, x2, z3, y2);
  off = buff.writePos(off, x1, z4, y1);
  var off = 0;
  off = buff.writeQuad(off, 0, 1, 2, 3);
  var off = 0;
  off = buff.writeLine(off, 0, 1);
  off = buff.writeLine(off, 1, 2);
  off = buff.writeLine(off, 2, 3);
  off = buff.writeLine(off, 3, 0);
}

function applyWallTextureTransform(wall:Wall, wall2:Wall, info:ArtInfo, base:number, originalWall:Wall=wall, texMat:GLM.Mat4Array) {
  var wall1 = wall;
  if (originalWall.cstat.xflip)
    [wall1, wall2] = [wall2, wall1];
  var flip = wall == originalWall ? 1 : -1;
  var tw = info.w;
  var th = info.h;
  var dx = wall2.x - wall1.x;
  var dy = wall2.y - wall1.y;
  var tcscalex = (originalWall.xrepeat * 8.0) / (flip * MU.len2d(dx, dy) * tw);
  var tcscaley = -(wall.yrepeat / 8.0) / (th * 16.0);
  var tcxoff = originalWall.xpanning / tw;
  var tcyoff = wall.ypanning / 256.0;
  
  GLM.mat4.identity(texMat);
  GLM.mat4.translate(texMat, texMat, [tcxoff, tcyoff, 0, 0]);
  GLM.mat4.scale(texMat, texMat, [tcscalex, tcscaley, 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
  GLM.mat4.translate(texMat, texMat, [-wall1.x, -base / SCALE, -wall1.y, 0]);
}

function prepareWall(board:Board, art:ArtProvider, wallId:number, secId:number, drawable:WallDrawable) {
  var wall= board.walls[wallId];
  var sector = board.sectors[secId];
  var wall2 = board.walls[wall.point2];
  var x1 = wall.x; var y1 = wall.y;
  var x2 = wall2.x; var y2 = wall2.y;
  var tex = art.get(wall.picnum);
  var info = art.getInfo(wall.picnum);
  var slope = U.createSlopeCalculator(sector, board.walls);
  var ceilingheinum = sector.ceilingheinum;
  var ceilingz = sector.ceilingz;
  var floorheinum = sector.floorheinum;
  var floorz = sector.floorz;
  var trans = (wall.cstat.translucent || wall.cstat.translucentReversed) ? 0.6 : 1;

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    fillBuffersForWall(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false, drawable.mid.buff);
    var base = wall.cstat.alignBottom ? floorz : ceilingz;
    applyWallTextureTransform(wall, wall2, info, base, wall, drawable.mid.texMat);
    drawable.mid.tex = tex;
    drawable.mid.shade = wall.shade;
    drawable.mid.pal = wall.pal;
  } else {
    var nextsector = board.sectors[wall.nextsector];
    var nextslope = U.createSlopeCalculator(nextsector, board.walls);
    var nextfloorz = nextsector.floorz;
    var nextceilingz = nextsector.ceilingz;

    var nextfloorheinum = nextsector.floorheinum;
    if (fillBuffersForWall(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true, drawable.bot.buff)) {
      var wall_ = wall.cstat.swapBottoms ? board.walls[wall.nextwall] : wall;
      var wall2_ = wall.cstat.swapBottoms ? board.walls[wall_.point2] : wall2;
      var tex_ = wall.cstat.swapBottoms ? art.get(wall_.picnum) : tex;
      var info_ = wall.cstat.swapBottoms ? art.getInfo(wall_.picnum) : info;
      var base = wall.cstat.alignBottom ? ceilingz : nextfloorz;
      applyWallTextureTransform(wall_, wall2_, info_, base, wall, drawable.bot.texMat);
      drawable.bot.tex = tex_;
      drawable.bot.shade = wall_.shade;
      drawable.bot.pal = wall_.pal;
    } 

    var nextceilingheinum = nextsector.ceilingheinum;
    if (fillBuffersForWall(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true, drawable.top.buff)) {
      var base = wall.cstat.alignBottom ? ceilingz : nextceilingz;
      applyWallTextureTransform(wall, wall2, info, base, wall, drawable.top.texMat);
      drawable.top.tex = tex;
      drawable.top.shade = wall.shade;
      drawable.top.pal = wall.pal;
    }

    if (wall.cstat.masking) {
      var tex1 = art.get(wall.overpicnum);
      var info1 = art.getInfo(wall.overpicnum);
      fillBuffersForMaskedWall(x1, y1, x2, y2, slope, nextslope, 
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz, drawable.mid.buff);
      var base = wall.cstat.alignBottom ? Math.min(floorz, nextfloorz) : Math.max(ceilingz, nextceilingz);
      applyWallTextureTransform(wall, wall2, info1, base, wall, drawable.mid.texMat);
      drawable.mid.tex = tex1;
      drawable.mid.shade = wall.shade;
      drawable.mid.pal = wall.pal;
    } 
  }
}

function fillbuffersForWallSprite(x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, ang:number, xf:number, yf:number, onesided:number, drawable:SpriteDrawable) {
  var dx = Math.sin(ang)*hw;
  var dy = Math.cos(ang)*hw;
  drawable.buff.allocate(4, onesided?6:12, 8);
  var off = 0;
  off = drawable.buff.writePos(off, x-dx, z-hh+yo, y-dy);
  off = drawable.buff.writePos(off, x+dx, z-hh+yo, y+dy);
  off = drawable.buff.writePos(off, x+dx, z+hh+yo, y+dy);
  off = drawable.buff.writePos(off, x-dx, z+hh+yo, y-dy);
  genSpriteQuad(drawable.buff, onesided);

  var xf = xf ? -1.0 : 1.0;
  var yf = yf ? -1.0 : 1.0;
  var texMat = drawable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xf/(hw*2), -yf/(hh*2), 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -ang - Math.PI/2);
  GLM.mat4.translate(texMat, texMat, [-x-xf*dx, -z-yf*hh-yo, -y-xf*dy, 0]);
}

function fillbuffersForFloorSprite(x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, ang:number, xf:number, yf:number, onesided:number, drawable:SpriteDrawable) {
  drawable.buff.allocate(4, onesided?6:12, 8);
  var dwx = Math.sin(-ang)*hw;
  var dwy = Math.cos(-ang)*hw;
  var dhx = Math.sin(-ang+Math.PI/2)*hh;
  var dhy = Math.cos(-ang+Math.PI/2)*hh;
  var off = 0;
  off = drawable.buff.writePos(off, x-dwx-dhx, z, y-dwy-dhy);
  off = drawable.buff.writePos(off, x+dwx-dhx, z, y+dwy-dhy);
  off = drawable.buff.writePos(off, x+dwx+dhx, z, y+dwy+dhy);
  off = drawable.buff.writePos(off, x-dwx+dhx, z, y-dwy+dhy);
  genSpriteQuad(drawable.buff, onesided);

  var xf = xf ? -1.0 : 1.0;
  var yf = yf ? -1.0 : 1.0;
  var texMat = drawable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xf/(hw*2), yf/(hh*2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw, hh, 0, 0]);
  GLM.mat4.rotateZ(texMat, texMat, -ang - Math.PI/2);
  GLM.mat4.translate(texMat, texMat, [-x, -y, 0, 0]);
  GLM.mat4.rotateX(texMat, texMat, -Math.PI/2);
}

function fillBuffersForFaceSprite(x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, xf:number, yf:number, drawable:SpriteDrawable) {
  drawable.buff.allocate(4, 6, 8);
  var off = 0;
  off = drawable.buff.writePos(off, x, z, y);
  off = drawable.buff.writePos(off, x, z, y);
  off = drawable.buff.writePos(off, x, z, y);
  off = drawable.buff.writePos(off, x, z, y);
  var off = 0;
  off = drawable.buff.writeNormal(off, -hw+xo, +hh+yo);
  off = drawable.buff.writeNormal(off, +hw+xo, +hh+yo);
  off = drawable.buff.writeNormal(off, +hw+xo, -hh+yo);
  off = drawable.buff.writeNormal(off, -hw+xo, -hh+yo);
  genSpriteQuad(drawable.buff, 1);

  var texMat = drawable.texMat;
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [1/(hw*2), -1/(hh*2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw-xo, -hh-yo, 0, 0]);
}

function genSpriteQuad(buff:Buffer, onesided:number) {
  var off = 0;
  off = buff.writeQuad(off, 0, 1, 2, 3);
  if (!onesided)
    off = buff.writeQuad(off, 3, 2, 1, 0);
  off = 0;
  off = buff.writeLine(off, 0, 1);
  off = buff.writeLine(off, 1, 2);
  off = buff.writeLine(off, 2, 3);
  off = buff.writeLine(off, 3, 0);
}

function prepareSprite(board:Board, art:ArtProvider, sprId:number, drawable:SpriteDrawable) {
  var spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invicible)
    return;

  var x = spr.x; var y = spr.y; var z = spr.z / SCALE;
  var info = art.getInfo(spr.picnum);
  var tex = art.get(spr.picnum);
  var w = (info.w * spr.xrepeat) / 4; var hw = w >> 1;
  var h = (info.h * spr.yrepeat) / 4; var hh = h >> 1;
  var ang = MU.PI2 - (spr.ang / 2048) * MU.PI2;
  var xo = (info.attrs.xoff * spr.xrepeat) / 4;
  var yo = (info.attrs.yoff * spr.yrepeat) / 4 + (spr.cstat.realCenter ? 0 : hh);
  var xf = spr.cstat.xflip; var yf = spr.cstat.yflip;
  var sec = board.sectors[spr.sectnum];
  var sectorShade = sec.floorshade;
  var shade = spr.shade == -8 ? sectorShade : spr.shade;
  var trans = (spr.cstat.translucent || spr.cstat.tranclucentReversed) ? 0.6 : 1;
  drawable.tex = tex;
  drawable.shade = shade;
  drawable.pal = spr.pal;
  drawable.trans = trans;
  
  if (spr.cstat.type == FACE) {
    fillBuffersForFaceSprite(x, y, z, xo, yo, hw, hh, xf, yf, drawable);
    drawable.type = Type.FACE;
  } else if (spr.cstat.type == WALL) {
    fillbuffersForWallSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, drawable);
  } else if (spr.cstat.type == FLOOR) {
    fillbuffersForFloorSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, drawable);
  }
}