import * as DS from '../../../drawstruct';
import * as U from '../utils';
import * as ART from '../art';
import * as MU from '../../../../libs/mathutils';
import * as C from '../../../../modules/controller3d';
import * as BS from '../structs';
import * as GLU from '../../../../libs_js/glutess';
import * as GLM from '../../../../libs_js/glmatrix';
import * as GL from '../../../../modules/gl';
import * as PROFILE from '../../../../modules/profiler';
import * as BGL from './buildgl';
import * as BUFF from './buffers';
import * as DRAWABLE from './drawable';

export type SectorVisitor = (board:BS.Board, sectorId:number) => void;
export type WallVisitor = (board:BS.Board, wallId:number, sectorId:number) => void;
export type SpriteVisitor = (board:BS.Board, spriteId:number) => void;

function groupSprites(sprites:BS.Sprite[]) {
  var sec2spr = {};
  for (var s = 0; s < sprites.length; s++) {
    var spr = sprites[s];
    var sprs = sec2spr[spr.sectnum];
    if (sprs == undefined) {
      sprs = [];
      sec2spr[spr.sectnum] = sprs;
    }
    sprs.push(s);
  }
  return sec2spr;
}

type traverser = (board:BS.Board, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) => void;

function visitAll(board:BS.Board, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) {
  for (var s = 0; s < board.sectors.length; s++) {
    var sec = board.sectors[s];
    secv(board, s);
    for (var w = sec.wallptr; w < sec.wallnum+sec.wallptr; w++) {
      wallv(board, w, s);
    }
  }
  for (var s = 0; s < board.sprites.length; s++) {
    sprv(board, s);
  }
}

function visitVisible(board:BS.Board, ms:U.MoveStruct, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) {
  var pvs = [ms.sec];
  var sectors = board.sectors;
  var walls = board.walls;
  var sprites = board.sprites;
  var sec2spr = groupSprites(sprites);
  for (var i = 0; i < pvs.length; i++) {
    var secIdx = pvs[i];
    var sec = sectors[secIdx];

    if (sec != undefined) {
      secv(board, secIdx);
    }

    for (var w = 0; w < sec.wallnum; w++) {
      var wallidx = sec.wallptr + w;
      var wall = walls[wallidx];
      if (wall != undefined && U.wallVisible(wall, board.walls[wall.point2], ms)) {
        wallv(board, wallidx, secIdx);
        var nextsector = wall.nextsector;
        if (nextsector == -1) continue;
        if (pvs.indexOf(nextsector) == -1)
          pvs.push(nextsector);
      }
    }

    var sprs = sec2spr[secIdx];
    if (sprs != undefined) {
      sprs.map((sid) => sprv(board, sid));
    }
  }
}

export class DrawQueue {
  private surfaces:DRAWABLE.T[];
  private sprites:DRAWABLE.T[];
  private secv:SectorVisitor;
  private wallv:WallVisitor;
  private sprv:SpriteVisitor;
  private cache:Cache;

  constructor(private board:BS.Board) {
    this.cache = new Cache(board);
    this.secv = (board:BS.Board, sectorId:number) => {
      var sector = this.cache.getSector(sectorId);
      this.surfaces.push(sector.ceiling, sector.floor);
      PROFILE.incCount('sectors');
    }
    this.wallv = (board:BS.Board, wallId:number, sectorId:number) => {
      var wall = this.cache.getWall(wallId, sectorId);
      this.surfaces.push(wall.bot, wall.mid, wall.top);
      PROFILE.incCount('walls');
    }
    this.sprv = (board:BS.Board, spriteId:number) => {
      var sprite = this.cache.getSprite(spriteId);
      this.sprites.push(sprite);
      PROFILE.incCount('sprites');
    } 
  }

  public draw(gl:WebGLRenderingContext, t:traverser) {
    this.surfaces = [];
    this.sprites = [];

    PROFILE.startProfile('processing');
    t(this.board, this.secv, this.wallv, this.sprv);
    PROFILE.endProfile();

    PROFILE.startProfile('draw');
    for (var i = 0; i < this.surfaces.length; i++) {
      BGL.draw(gl, this.surfaces[i]);
    }

    gl.polygonOffset(-1, -8);
    for (var i = 0; i < this.sprites.length; i++) {
      BGL.draw(gl, this.sprites[i]);
    }
    gl.polygonOffset(0, 0);
    PROFILE.endProfile();
  }
}

export class SectorDrawable {
  public ceiling:DRAWABLE.T = DRAWABLE.create();
  public floor:DRAWABLE.T = DRAWABLE.create();
}

export class WallDrawable {
  public top:DRAWABLE.T = DRAWABLE.create();
  public mid:DRAWABLE.T = DRAWABLE.create();
  public bot:DRAWABLE.T = DRAWABLE.create();
}

export class SpriteDrawable extends DRAWABLE.T {}

export class Cache {
  public sectors:SectorDrawable[] = [];
  public walls:WallDrawable[] = [];
  public sprites:SpriteDrawable[] = [];

  constructor(private board:BS.Board) {}

  public getSector(id:number):SectorDrawable {
    var sector = this.sectors[id];
    if (sector == undefined) {
      sector = new SectorDrawable();
      this.sectors[id] = sector;
      prepareSector(this.board, id, sector);
    }
    return sector;
  }

  public getWall(wallId:number, sectorId:number):WallDrawable {
    var wall = this.walls[wallId];
    if (wall == undefined) {
      wall = new WallDrawable();
      this.walls[wallId] = wall;
      prepareWall(this.board, wallId, sectorId, wall);
    }
    return wall;
  }

  public getSprite(spriteId:number):SpriteDrawable {
    var sprite = this.sprites[spriteId];
    if (sprite == undefined) {
      sprite = new SpriteDrawable();
      this.sprites[spriteId] = sprite;
      prepareSprite(this.board, spriteId, sprite);
    }
    return sprite;
  }
}


const SCALE = -16;

export interface ArtProvider extends ART.ArtInfoProvider {
  get(picnum:number):DS.Texture;
  getPalTexture():DS.Texture;
  getPluTexture():DS.Texture;
}

export function init(gl:WebGLRenderingContext, p:ArtProvider, board:BS.Board) {
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  setArtProvider(p);
  BGL.init(gl);
  BGL.state.setPalTexture(p.getPalTexture());
  BGL.state.setPluTexture(p.getPluTexture());

  queue = new DrawQueue(board);
}

var artProvider:ArtProvider = null;
function setArtProvider(p:ArtProvider) {
  artProvider = p;
}

var queue:DrawQueue;

function applySectorTextureTransform(sector:BS.Sector, ceiling:boolean, walls:BS.Wall[], info:ART.ArtInfo, texMat:GLM.Mat4Array) {
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

function triangulate(sector:BS.Sector, walls:BS.Wall[]):number[][] {
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
  return GLU.tesselate(contours);
}

var tricache = {};
function cacheTriangulate(board:BS.Board, sec:BS.Sector) {
  var res = tricache[sec.wallptr];
  if (res == undefined) {
    res = triangulate(sec, board.walls);
    tricache[sec.wallptr] = res;
  }
  return res;
}

function fillBuffersForSectorWireframe(ceil:boolean, board:BS.Board, sec:BS.Sector, voff:number, buff:DRAWABLE.Buffer) {
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

function fillBuffersForSectorNormal(ceil:boolean, board:BS.Board, sec:BS.Sector, buff:DRAWABLE.Buffer, vtxs:number[][], vidxs:number[]) {
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

function fillBuffersForSector(ceil:boolean, board:BS.Board, sec:BS.Sector, drawable:SectorDrawable) {
    var [vtxs, vidxs] = cacheTriangulate(board, sec);
    var d = ceil ? drawable.ceiling : drawable.floor;
    d.buff.allocate(vtxs.length+sec.wallnum, vidxs.length, sec.wallnum*2);
    fillBuffersForSectorNormal(ceil, board, sec, d.buff, vtxs, vidxs);
    fillBuffersForSectorWireframe(ceil, board, sec, vtxs.length, d.buff);
}

function prepareSector(board:BS.Board, secId:number, drawable:SectorDrawable) {
  var sec = board.sectors[secId];
  fillBuffersForSector(true, board, sec, drawable);
  drawable.ceiling.tex = artProvider.get(sec.ceilingpicnum);
  drawable.ceiling.pal = sec.ceilingpal;
  drawable.ceiling.shade = sec.ceilingshade;
  var info = artProvider.getInfo(sec.ceilingpicnum);
  applySectorTextureTransform(sec, true, board.walls, info, drawable.ceiling.texMat);

  fillBuffersForSector(false, board, sec, drawable);
  drawable.floor.tex = artProvider.get(sec.floorpicnum);
  drawable.floor.pal = sec.floorpal;
  drawable.floor.shade = sec.floorshade;
  var info = artProvider.getInfo(sec.floorpicnum);
  applySectorTextureTransform(sec, false, board.walls, info, drawable.floor.texMat);
}

function fillBuffersForWall(x1:number, y1:number, x2:number, y2:number, 
  slope:any, nextslope:any, heinum:number, nextheinum:number, z:number, nextz:number, check:boolean, buff:DRAWABLE.Buffer):boolean {
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
  floorheinum:number, floornextheinum:number, floorz:number, floornextz:number, buff:DRAWABLE.Buffer):void {
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

function genWallQuad(x1:number, y1:number, x2:number, y2:number, z1:number, z2:number, z3:number, z4:number, buff:DRAWABLE.Buffer) {
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

function applyWallTextureTransform(wall:BS.Wall, wall2:BS.Wall, info:ART.ArtInfo, base:number, originalWall:BS.Wall=wall, texMat:GLM.Mat4Array) {
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

function prepareWall(board:BS.Board, wallId:number, secId:number, drawable:WallDrawable) {
  var wall= board.walls[wallId];
  var sector = board.sectors[secId];
  var wall2 = board.walls[wall.point2];
  var x1 = wall.x; var y1 = wall.y;
  var x2 = wall2.x; var y2 = wall2.y;
  var tex = artProvider.get(wall.picnum);
  var info = artProvider.getInfo(wall.picnum);
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
      var tex_ = wall.cstat.swapBottoms ? artProvider.get(wall_.picnum) : tex;
      var info_ = wall.cstat.swapBottoms ? artProvider.getInfo(wall_.picnum) : info;
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
      var tex1 = artProvider.get(wall.overpicnum);
      var info1 = artProvider.getInfo(wall.overpicnum);
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

function genSpriteQuad(buff:DRAWABLE.Buffer, onesided:number) {
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

function prepareSprite(board:BS.Board, sprId:number, drawable:SpriteDrawable) {
  var spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invicible)
    return;

  var x = spr.x; var y = spr.y; var z = spr.z / SCALE;
  var info = artProvider.getInfo(spr.picnum);
  var tex = artProvider.get(spr.picnum);
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
  
  if (spr.cstat.type == BS.FACE) {
    fillBuffersForFaceSprite(x, y, z, xo, yo, hw, hh, xf, yf, drawable);
    drawable.type = DRAWABLE.FACE;
  } else if (spr.cstat.type == BS.WALL) {
    fillbuffersForWallSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, drawable);
  } else if (spr.cstat.type == BS.FLOOR) {
    fillbuffersForFloorSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided, drawable);
  }
}

function drawInSector(gl:WebGLRenderingContext, board:BS.Board, ms:U.MoveStruct) {
  queue.draw(gl, (board:BS.Board, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) => visitVisible(board, ms, secv, wallv, sprv));
}

function drawAll(gl:WebGLRenderingContext, board:BS.Board) {
  queue.draw(gl, visitAll);
}

export function draw(gl:WebGLRenderingContext, board:BS.Board, ms:U.MoveStruct, ctr:C.Controller3D) {
  BGL.setController(ctr);

  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawImpl(gl, board, ms);

  // hitscan(board, ms, ctr);
  // if (hitscanResult.hitt != -1) {
  //   mode = MODE_WIREFRAME;
  //   gl.disable(gl.DEPTH_TEST);
  //   if (hitscanResult.hitsprite != -1) {
  //     drawSprite(gl, board.ref, board.sprites[hitscanResult.hitsprite].ref, board.sprites[hitscanResult.hitsprite].id);
  //   } else if (hitscanResult.hitsect != -1) {
  //     drawSector(gl, board.ref, board.sectors[hitscanResult.hitsect].ref, board.sectors[hitscanResult.hitsect].id);
  //   } else if (hitscanResult.hitwall != -1) {
  //     drawWall(gl, board.ref, board.walls[hitscanResult.hitwall].ref, board.walls[hitscanResult.hitwall].id, board.walls[hitscanResult.hitwall].sector.ref);
  //   }
  //   gl.enable(gl.DEPTH_TEST);
  // }
}

function drawImpl(gl:WebGLRenderingContext, board:BS.Board, ms:U.MoveStruct) {
  if (!U.inSector(board, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board, ms.x, ms.y, ms.sec);
  }
  if (ms.sec == -1) {
    drawAll(gl, board);
  } else {
    drawInSector(gl, board, ms);
  }
}