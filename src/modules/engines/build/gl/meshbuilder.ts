import * as DS from '../../../drawstruct';
import * as BW from '../buildwrapper';
import * as U from '../utils';
import * as MU from '../../../../libs/mathutils';
import * as C from '../../../../modules/controller3d';
import * as BS from '../structs';
import * as GLU from '../../../../libs_js/glutess';
import * as GLM from '../../../../libs_js/glmatrix';
import * as GL from '../../../../modules/gl';
import * as BGL from './buildgl';
import * as BUFF from './buffers';
import * as BAG from '../../../../libs/bag';

const SCALE = -16;

export interface ArtProvider {
  get(picnum:number):DS.Texture;
  getInfo(picnum:number):number;
  getPalTexture():DS.Texture;
  getPluTexture():DS.Texture;
}

export function init(gl:WebGLRenderingContext, p:ArtProvider, ctr:C.Controller3D) {
  setArtProvider(p);
  BGL.init(gl);
  BGL.state.setPalTexture(p.getPalTexture());
  BGL.state.setPluTexture(p.getPluTexture());
}

var artProvider:ArtProvider = null;
function setArtProvider(p:ArtProvider) {
  artProvider = p;
}

const MODE_NORMAL = 0;
const MODE_SELECT = 1;
const MODE_WIREFRAME = 2;

var mode = MODE_NORMAL;

var floors:BAG.Place[] = [];
var ceilings:BAG.Place[] = [];
var wallup:BAG.Place[] = [];
var wallmiddle:BAG.Place[] = [];
var walldown:BAG.Place[] = [];
var sprites:BAG.Place[] = [];

function applySectorTextureTransform(sector:BS.Sector, ceiling:boolean, walls:BS.Wall[], tex:DS.Texture) {
  var xpan = ceiling ? sector.ceilingxpanning : sector.floorxpanning;
  var ypan = ceiling ? sector.ceilingypanning : sector.floorypanning;
  var stats = ceiling ? sector.ceilingstat : sector.floorstat;
  var scale = stats.doubleSmooshiness ? 8.0 : 16.0;
  var tcscalex = (stats.xflip ? -1.0 :  1.0) / (tex.getWidth() * scale);
  var tcscaley = (stats.yflip ? -1.0 :  1.0) / (tex.getHeight() * scale);
  var texMat = BGL.state.getTextureMatrix();
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

function fillBuffersForSector(ceil:boolean, board:BS.Board, sec:BS.Sector, id:number) {
  var buffs = ceil ? ceilings : floors; 
  var buff = buffs[id];
  if (buff == undefined) {
    var [vtxs, vidxs] = cacheTriangulate(board, sec);
    buff = BUFF.allocate(vtxs.length+sec.wallnum, vidxs.length, sec.wallnum*2);
    buffs[id] = buff;

    var heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
    var z = ceil ? sec.ceilingz : sec.floorz;
    var slope = U.createSlopeCalculator(sec, board.walls);
    var off = 0;

    for (var i = 0; i < vtxs.length; i++) {
      var vx = vtxs[i][0];
      var vy = vtxs[i][1];
      var vz = (slope(vx, vy, heinum) + z) / SCALE;
      off = BUFF.writePos(buff, off, vx, vz, vy);
    }

    off = 0;
    for (var i = 0; i < vidxs.length; i+=3) {
      if (ceil) {
        off = BUFF.writeTriangle(buff, off, vidxs[i+0], vidxs[i+1], vidxs[i+2]);
      } else {
        off = BUFF.writeTriangle(buff, off, vidxs[i+2], vidxs[i+1], vidxs[i+0]);
      }
    }

    var fw = sec.wallptr;
    var voff = vtxs.length;
    off = 0;
    for (var w = 0; w < sec.wallnum; w++) {
      var wid = sec.wallptr + w;
      var wall = board.walls[wid];
      var vx = wall.x;
      var vy = wall.y;
      var vz = (slope(vx, vy, heinum) + z) / SCALE;
      voff = BUFF.writePos(buff, voff, vx, vz, vy);
      if (fw != wid) {
        off = BUFF.writeLine(buff, off, vtxs.length+w-1, vtxs.length+w);
      }
      if (wall.point2 == fw) {
        off = BUFF.writeLine(buff, off, vtxs.length+w, vtxs.length+fw-sec.wallptr);
        fw = wid + 1;
      } 
    }
  }
  BGL.state.setDrawElements(buff);
}

function BGLdraw(gl:WebGLRenderingContext, tex:DS.Texture, shade:number, pal:number, id:number, trans:number=1, sprite:boolean=false) {
  if (mode == MODE_NORMAL) {
    BGL.state.setShader(sprite ? BGL.spriteShader : BGL.baseShader);
    BGL.state.setColor([1,1,1,trans]);
    BGL.state.setTexture(tex);
    BGL.state.setShade(shade);
    BGL.state.setPal(pal);
    BGL.state.draw(gl);
  } else if (mode == MODE_SELECT) {
    BGL.state.setShader(sprite ? BGL.spriteSelectShader : BGL.selectShader);
    BGL.state.setTexture(tex);
    BGL.state.setCurrentId(id);
    BGL.state.draw(gl);
  } else if (mode == MODE_WIREFRAME) {
    BGL.state.setShader(sprite ? BGL.spriteFlatShader : BGL.baseFlatShader);
    BGL.state.setColor([1,1,1,0.3]);
    BGL.state.draw(gl, gl.LINES);
  }
}

function drawSector(gl:WebGLRenderingContext, board:BS.Board, sec:BS.Sector, id:number) {
  fillBuffersForSector(true, board, sec, id);
  var tex = artProvider.get(sec.ceilingpicnum);
  applySectorTextureTransform(sec, true, board.walls, tex);
  BGLdraw(gl, tex, sec.ceilingshade, sec.ceilingpal, id);

  fillBuffersForSector(false, board, sec, id);
  var tex = artProvider.get(sec.floorpicnum);
  applySectorTextureTransform(sec, false, board.walls, tex);
  BGLdraw(gl, tex, sec.floorshade, sec.floorpal, id);
}

function fillBuffersForWall(x1:number, y1:number, x2:number, y2:number, 
  slope:any, nextslope:any, heinum:number, nextheinum:number, z:number, nextz:number, check:boolean,
  buffs:BAG.Place[], id:number):boolean {
  var z1 = (slope(x1, y1, heinum) + z) / SCALE; 
  var z2 = (slope(x2, y2, heinum) + z) / SCALE;
  var z3 = (nextslope(x2, y2, nextheinum) + nextz) / SCALE;
  var z4 = (nextslope(x1, y1, nextheinum) + nextz) / SCALE;
  if (check && (z4 >= z1 && z3 >= z2))
    return false;
  var buff = buffs[id];
  if (buff == undefined) {
    buff = BUFF.allocate(4, 6, 8);
    buffs[id] = buff;
    genWallQuad(x1, y1, x2, y2, z1, z2, z3, z4, buff);
  }
  BGL.state.setDrawElements(buff);
  return true;
}

function fillBuffersForMaskedWall(x1:number, y1:number, x2:number, y2:number, slope:any, nextslope:any, 
  ceilheinum:number, ceilnextheinum:number, ceilz:number, ceilnextz:number,
  floorheinum:number, floornextheinum:number, floorz:number, floornextz:number,
  buffs:BAG.Place[], id:number):void {
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
  var buff = buffs[id];
  if (buff == undefined) {
    buff = BUFF.allocate(4, 6, 8);
    buffs[id] = buff;
    genWallQuad(x1, y1, x2, y2, z1, z2, z3, z4, buff);
  }
  BGL.state.setDrawElements(buff);
}

function genWallQuad(x1:number, y1:number, x2:number, y2:number, z1:number, z2:number, z3:number, z4:number, buff:BAG.Place) {
  var off = 0;
  off = BUFF.writePos(buff, off, x1, z1, y1);
  off = BUFF.writePos(buff, off, x2, z2, y2);
  off = BUFF.writePos(buff, off, x2, z3, y2);
  off = BUFF.writePos(buff, off, x1, z4, y1);
  var off = 0;
  off = BUFF.writeQuad(buff, off, 0, 1, 2, 3);
  var off = 0;
  off = BUFF.writeLine(buff, off, 0, 1);
  off = BUFF.writeLine(buff, off, 1, 2);
  off = BUFF.writeLine(buff, off, 2, 3);
  off = BUFF.writeLine(buff, off, 3, 0);
}

function applyWallTextureTransform(wall:BS.Wall, wall2:BS.Wall, tex:DS.Texture, base:number, originalWall:BS.Wall=wall) {
  var wall1 = wall;
  if (originalWall.cstat.xflip)
    [wall1, wall2] = [wall2, wall1];
  var flip = wall == originalWall ? 1 : -1;
  var tw = tex.getWidth();
  var th = tex.getHeight();
  var dx = wall2.x - wall1.x;
  var dy = wall2.y - wall1.y;
  var tcscalex = (originalWall.xrepeat * 8.0) / (flip * MU.len2d(dx, dy) * tw);
  var tcscaley = -(wall.yrepeat / 8.0) / (th * 16.0);
  var tcxoff = originalWall.xpanning / tw;
  var tcyoff = wall.ypanning / 256.0;
  
  var texMat = BGL.state.getTextureMatrix();
  GLM.mat4.identity(texMat);
  GLM.mat4.translate(texMat, texMat, [tcxoff, tcyoff, 0, 0]);
  GLM.mat4.scale(texMat, texMat, [tcscalex, tcscaley, 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
  GLM.mat4.translate(texMat, texMat, [-wall1.x, -base / SCALE, -wall1.y, 0]);
}

function drawWall(gl:WebGLRenderingContext, board:BS.Board, wall:BS.Wall, id:number, sector:BS.Sector) {
  var wall2 = board.walls[wall.point2];
  var x1 = wall.x; var y1 = wall.y;
  var x2 = wall2.x; var y2 = wall2.y;
  var tex = artProvider.get(wall.picnum);
  var slope = U.createSlopeCalculator(sector, board.walls);
  var ceilingheinum = sector.ceilingheinum;
  var ceilingz = sector.ceilingz;
  var floorheinum = sector.floorheinum;
  var floorz = sector.floorz;
  var trans = (wall.cstat.translucent || wall.cstat.translucentReversed) ? 0.6 : 1;

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    fillBuffersForWall(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false, wallmiddle, id);
    var base = wall.cstat.alignBottom ? floorz : ceilingz;
    applyWallTextureTransform(wall, wall2, tex, base);
    BGLdraw(gl, tex, wall.shade, wall.pal, id);
  } else {
    var nextsector = board.sectors[wall.nextsector];
    var nextslope = U.createSlopeCalculator(nextsector, board.walls);
    var nextfloorz = nextsector.floorz;
    var nextceilingz = nextsector.ceilingz;

    var nextfloorheinum = nextsector.floorheinum;
    if (fillBuffersForWall(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true, walldown, id)) {
      var wall_ = wall.cstat.swapBottoms ? board.walls[wall.nextwall] : wall;
      var wall2_ = wall.cstat.swapBottoms ? board.walls[wall_.point2] : wall2;
      var tex_ = wall.cstat.swapBottoms ? artProvider.get(wall_.picnum) : tex;
      var base = wall.cstat.alignBottom ? floorz : nextfloorz;
      applyWallTextureTransform(wall_, wall2_, tex_, base, wall);
      BGLdraw(gl, tex_, wall_.shade, wall_.pal, id);
    }

    var nextceilingheinum = nextsector.ceilingheinum;
    if (fillBuffersForWall(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true, wallup, id)) {
      var base = wall.cstat.alignBottom ? ceilingz : nextceilingz;
      applyWallTextureTransform(wall, wall2, tex, base);
      BGLdraw(gl, tex, wall.shade, wall.pal, id);
    }

    if (wall.cstat.masking) {
      var tex1 = artProvider.get(wall.overpicnum);
      fillBuffersForMaskedWall(x1, y1, x2, y2, slope, nextslope, 
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz, wallmiddle, id);
      var base = wall.cstat.alignBottom ? Math.min(floorz, nextfloorz) : Math.max(ceilingz, nextceilingz);
      applyWallTextureTransform(wall, wall2, tex1, base);
      BGLdraw(gl, tex1, wall.shade, wall.pal, id, trans);
    }
  }
}

function fillbuffersForWallSprite(id:number, x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, ang:number, xf:number, yf:number, onesided:number) {
  var dx = Math.sin(ang)*hw;
  var dy = Math.cos(ang)*hw;
  var buff = sprites[id];
  if (buff == undefined) {
    buff = BUFF.allocate(4, onesided?6:12, 8);
    sprites[id] = buff;

    var off = 0;
    off = BUFF.writePos(buff, off, x-dx, z-hh+yo, y-dy);
    off = BUFF.writePos(buff, off, x+dx, z-hh+yo, y+dy);
    off = BUFF.writePos(buff, off, x+dx, z+hh+yo, y+dy);
    off = BUFF.writePos(buff, off, x-dx, z+hh+yo, y-dy);
    genSpriteQuad(buff, onesided);
  }
  BGL.state.setDrawElements(buff);

  var xf = xf ? -1.0 : 1.0;
  var yf = yf ? -1.0 : 1.0;
  var texMat = BGL.state.getTextureMatrix();
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xf/(hw*2), -yf/(hh*2), 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -ang - Math.PI/2);
  GLM.mat4.translate(texMat, texMat, [-x-xf*dx, -z-yf*hh-yo, -y-xf*dy, 0]);
}

function fillbuffersForFloorSprite(id:number, x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, ang:number, xf:number, yf:number, onesided:number) {
  var buff = sprites[id];
  if (buff == undefined) {
    buff = BUFF.allocate(4, onesided?6:12, 8);
    sprites[id] = buff;
    var dwx = Math.sin(-ang)*hw;
    var dwy = Math.cos(-ang)*hw;
    var dhx = Math.sin(-ang+Math.PI/2)*hh;
    var dhy = Math.cos(-ang+Math.PI/2)*hh;
    var off = 0;
    off = BUFF.writePos(buff, off, x-dwx-dhx, z, y-dwy-dhy);
    off = BUFF.writePos(buff, off, x+dwx-dhx, z, y+dwy-dhy);
    off = BUFF.writePos(buff, off, x+dwx+dhx, z, y+dwy+dhy);
    off = BUFF.writePos(buff, off, x-dwx+dhx, z, y-dwy+dhy);
    genSpriteQuad(buff, onesided);
  }
  BGL.state.setDrawElements(buff);

  var xf = xf ? -1.0 : 1.0;
  var yf = yf ? -1.0 : 1.0;
  var texMat = BGL.state.getTextureMatrix();
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xf/(hw*2), yf/(hh*2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw, hh, 0, 0]);
  GLM.mat4.rotateZ(texMat, texMat, -ang - Math.PI/2);
  GLM.mat4.translate(texMat, texMat, [-x, -y, 0, 0]);
  GLM.mat4.rotateX(texMat, texMat, -Math.PI/2);
}

function fillBuffersForFaceSprite(id:number, x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, xf:number, yf:number) {
  var buff = sprites[id];
  if (buff == undefined) {
    buff = BUFF.allocate(4, 6, 8);
    sprites[id] = buff;
    var off = 0;
    off = BUFF.writePos(buff, off, x, z, y);
    off = BUFF.writePos(buff, off, x, z, y);
    off = BUFF.writePos(buff, off, x, z, y);
    off = BUFF.writePos(buff, off, x, z, y);
    var off = 0;
    off = BUFF.writeNormal(buff, off, -hw, +hh+yo);
    off = BUFF.writeNormal(buff, off, +hw, +hh+yo);
    off = BUFF.writeNormal(buff, off, +hw, -hh+yo);
    off = BUFF.writeNormal(buff, off, -hw, -hh+yo);
    genSpriteQuad(buff, 1);
  }
  BGL.state.setDrawElements(buff);

  var texMat = BGL.state.getTextureMatrix();
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [1/(hw*2), -1/(hh*2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw, -hh-yo, 0, 0]);
}

function genSpriteQuad(buff:BAG.Place, onesided:number) {
  var off = 0;
  off = BUFF.writeQuad(buff, off, 0, 1, 2, 3);
  if (!onesided)
    off = BUFF.writeQuad(buff, off, 3, 2, 1, 0);
  off = 0;
  off = BUFF.writeLine(buff, off, 0, 1);
  off = BUFF.writeLine(buff, off, 1, 2);
  off = BUFF.writeLine(buff, off, 2, 3);
  off = BUFF.writeLine(buff, off, 3, 0);
}

function drawSprite(gl:WebGLRenderingContext, board:BS.Board, spr:BS.Sprite, id:number) {
  if (spr.picnum == 0 || spr.cstat.invicible)
    return;

  var x = spr.x; var y = spr.y; var z = spr.z / SCALE;
  var tex = artProvider.get(spr.picnum);
  var w = tex.getWidth(); var hw = (w*spr.xrepeat) / 8;
  var h = tex.getHeight(); var hh = (h*spr.yrepeat) / 8;
  var ang = MU.PI2 - (spr.ang / 2048) * MU.PI2;
  var tinfo = artProvider.getInfo(spr.picnum);
  var xo = MU.ubyte2byte((tinfo >> 8) & 0xFF)*16 * (spr.xrepeat/64);
  var yo = MU.ubyte2byte((tinfo >> 16) & 0xFF)*16 * (spr.yrepeat/64);
  var xf = spr.cstat.xflip; var yf = spr.cstat.yflip;
  var sec = board.sectors[spr.sectnum];
  var sectorShade = sec.floorshade;
  var shade = spr.shade == -8 ? sectorShade : spr.shade;
  var trans = (spr.cstat.translucent || spr.cstat.tranclucentReversed) ? 0.6 : 1;

  gl.polygonOffset(-1, -8);
  if (spr.cstat.type == 0) { // face
    fillBuffersForFaceSprite(id, x, y, z, xo, yo, hw, hh, xf, yf);
    BGLdraw(gl, tex, shade, spr.pal, id, trans, true);
  } else if (spr.cstat.type == 1) { // wall
    fillbuffersForWallSprite(id, x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided);
    BGLdraw(gl, tex, shade, spr.pal, id, trans);
  } else if (spr.cstat.type == 2) { // floor
    fillbuffersForFloorSprite(id, x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided);
    BGLdraw(gl, tex, shade, spr.pal, id, trans);
  }
  gl.polygonOffset(0, 0);
}

function drawInSector(gl:WebGLRenderingContext, board:BW.BoardWrapper, ms:U.MoveStruct, info) {
  var t = MU.int(window.performance.now());
  board.markVisible(ms, t);
  var sectors = board.markedSectors(t);
  var count = 0;
  for (var sec = sectors(); sec != null; sec = sectors()) {
    drawSector(gl, board.ref, sec.ref, sec.id);
    count ++;
  }
  info['Sectors:'] = count;
  var walls = board.markedWalls(t);
  count = 0;
  for (var wall = walls(); wall != null; wall = walls()) {
    drawWall(gl, board.ref, wall.ref, wall.id, wall.sector.ref);
    count ++;
  }
  info['Walls:'] = count;
  count = 0;
  var sprites = board.markedSprites(t);
  var faceSprites = [];
  for (var spr = sprites(); spr != null; spr = sprites()) {
    if (spr.ref.cstat.type == 0) {
      faceSprites.push(spr);
      continue;
    } 
    drawSprite(gl, board.ref, spr.ref, spr.id);
    count ++;
  }
  info['Sprites:'] = count;

  count = 0;
  for (var i = 0; i < faceSprites.length; i++) {
    var s = faceSprites[i];
    drawSprite(gl, board.ref, s.ref, s.id);
    count ++;
  }
  info['FaceSprites:'] = count;
  info['BufferUpdates:'] = BUFF.resetBufferUpdates();
}

function drawAll(gl:WebGLRenderingContext, board:BW.BoardWrapper) {
  var sectors = board.allSectors();
  for (var sec = sectors(); sec != null; sec = sectors()) {
    drawSector(gl, board.ref, sec.ref, sec.id);
  }
  var walls = board.allWalls();
  for (var wall = walls(); wall != null; wall = walls()) {
    drawWall(gl, board.ref, wall.ref, wall.id, wall.sector.ref);
  }
}

export function draw(gl:WebGLRenderingContext, board:BW.BoardWrapper, ms:U.MoveStruct, ctr:C.Controller3D, info) {
  BGL.setController(ctr);
  
  mode = MODE_SELECT;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawImpl(gl, board, ms, info);

  var selectedId = GL.readId(gl, ctr.getX(), ctr.getY());

  if (ctr.isClick()) {
    console.log(board.id2object[selectedId]);
  }
  if (board.id2object[selectedId] instanceof BW.SectorWrapper && ctr.getKeys()['1'.charCodeAt(0)]) {
    board.id2object[selectedId].ref.floorheinum += 32;
  }
  if (board.id2object[selectedId] instanceof BW.SectorWrapper && ctr.getKeys()['2'.charCodeAt(0)]) {
    board.id2object[selectedId].ref.floorheinum -= 32;
  }

  mode = MODE_NORMAL;
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawImpl(gl, board, ms, info);

  // mode = MODE_WIREFRAME;
  // gl.disable(gl.DEPTH_TEST);
  // drawImpl(gl, board, ms, info);
  // gl.enable(gl.DEPTH_TEST);


  var selected = board.id2object[selectedId];
  if (selected != undefined) {
    gl.disable(gl.DEPTH_TEST);
    mode = MODE_WIREFRAME;
    if (selected instanceof BW.SectorWrapper) {
      drawSector(gl, board.ref, selected.ref, selected.id);
    } else if (selected instanceof BW.WallWrapper) {
      drawWall(gl, board.ref, selected.ref, selected.id, selected.sector.ref);
    } else if (selected instanceof BW.SpriteWrapper) {
      drawSprite(gl, board.ref, selected.ref, selected.id);
    }
    gl.enable(gl.DEPTH_TEST);
  }
}

function drawImpl(gl:WebGLRenderingContext, board:BW.BoardWrapper, ms:U.MoveStruct, info) {
  if (!U.inSector(board.ref, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board.ref, ms.x, ms.y, ms.sec);
  }
  if (ms.sec == -1) {
    drawAll(gl, board);
  } else {
    drawInSector(gl, board, ms, info);
  }
}