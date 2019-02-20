import DS = require('../../../drawstruct');
import BW = require('../buildwrapper');
import U = require('../utils');
import MU = require('../../../../libs/mathutils');
import C = require('../../../../modules/controller3d');
import BS = require('../structs');
import GLU = require('../../../../libs_js/glutess');
import GLM = require('../../../../libs_js/glmatrix');
import GL = require('../../../../modules/gl');
import BGL = require('./buildgl');

const SCALE = -16;

export interface ArtProvider {
  get(picnum:number):DS.Texture;
  getInfo(picnum:number):number;
}

export function init(gl:WebGLRenderingContext, p:ArtProvider, ctr:C.Controller3D) {
  setArtProvider(p);
  BGL.init(gl);
}

var artProvider:ArtProvider = null;
function setArtProvider(p:ArtProvider) {
  artProvider = p;
}


const MODE_NORMAL = 0;
const MODE_SELECT = 1;
const MODE_WIREFRAME = 2;

var mode = MODE_NORMAL;

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


function fillBuffersForSector(ceil:boolean, board:BS.Board, sec:BS.Sector, vtxs:number[], vidxs:number[]) {
  var heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  var z = ceil ? sec.ceilingz : sec.floorz;
  var slope = U.createSlopeCalculator(sec, board.walls);
  BGL.begin();

  for (var i = 0; i < vtxs.length; i++) {
    var vx = vtxs[i][0];
    var vy = vtxs[i][1];
    var vz = (slope(vx, vy, heinum) + z) / SCALE;
    BGL.vtx(vx, vz, vy);
  }

  for (var i = 0; i < vidxs.length; i+=3) {
    if (ceil) {
      BGL.triangle(vidxs[i+0], vidxs[i+1], vidxs[i+2]);
    } else {
      BGL.triangle(vidxs[i+2], vidxs[i+1], vidxs[i+0]);
    }
  }
}

function fillBuffersForSectorWireframe(ceil:boolean, board:BS.Board, sec:BS.Sector) {
  var heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  var z = ceil ? sec.ceilingz : sec.floorz;
  var slope = U.createSlopeCalculator(sec, board.walls);
  BGL.begin();

  var fw = sec.wallptr;
  for (var w = 0; w < sec.wallnum; w++) {
    var wid = sec.wallptr + w;
    var wall = board.walls[wid];
    var vx = wall.x;
    var vy = wall.y;
    var vz = (slope(vx, vy, heinum) + z) / SCALE;
    BGL.vtx(vx, vz, vy);
    if (fw != wid) {
      BGL.line(w-1, w);
    }
    if (wall.point2 == fw) {
      BGL.line(w, fw-sec.wallptr);
      fw = wid + 1;
    } 
  }
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

function BGLdraw(gl:WebGLRenderingContext, tex:DS.Texture, shade:number, id:number, sprite:boolean=false) {
  if (mode == MODE_NORMAL) {
    BGL.state.setShader(sprite ? BGL.spriteShader : BGL.baseShader);
    BGL.state.setColor([1,1,1,1]);
    BGL.state.setTexture(tex);
    BGL.state.setShade(shade);
    BGL.state.draw(gl);
  } else if (mode == MODE_SELECT) {
    BGL.state.setShader(sprite ? BGL.spriteSelectShader : BGL.selectShader);
    BGL.state.setTexture(tex);
    BGL.state.setCurrentId(id);
    BGL.state.draw(gl);
  } else if (mode == MODE_WIREFRAME) {
    BGL.state.setShader(sprite ? BGL.spriteFlatShader : BGL.baseFlatShader);
    BGL.state.setColor([1,1,1,0.2]);
    BGL.state.draw(gl, gl.LINES);
  }
}

function drawSector(gl:WebGLRenderingContext, board:BS.Board, sec:BS.Sector, id:number) {
  if (mode == MODE_NORMAL) {
    var [vtxs, vidxs] = cacheTriangulate(board, sec);
    fillBuffersForSector(true, board, sec, vtxs, vidxs);
    var tex = artProvider.get(sec.ceilingpicnum);
    applySectorTextureTransform(sec, true, board.walls, tex);
    BGLdraw(gl, tex, sec.ceilingshade, id);
    fillBuffersForSector(false, board, sec, vtxs, vidxs);
    var tex = artProvider.get(sec.floorpicnum);
    applySectorTextureTransform(sec, false, board.walls, tex);
    BGLdraw(gl, tex, sec.floorshade, id);
  } else if (mode == MODE_SELECT) {
    var [vtxs, vidxs] = cacheTriangulate(board, sec);
    fillBuffersForSector(true, board, sec, vtxs, vidxs);
    var tex = artProvider.get(sec.ceilingpicnum);
    BGLdraw(gl, tex, 0, id);
    fillBuffersForSector(false, board, sec, vtxs, vidxs);
    var tex = artProvider.get(sec.floorpicnum);
    BGLdraw(gl, tex, 0, id);
  } else if (mode == MODE_WIREFRAME) {
    fillBuffersForSectorWireframe(true, board, sec);
    BGLdraw(gl, null, 0, 0);
    fillBuffersForSectorWireframe(false, board, sec);
    BGLdraw(gl, null, 0, 0);
  }
}

function fillBuffersForWall(x1:number, y1:number, x2:number, y2:number, slope:any, nextslope:any, heinum:number, nextheinum:number, z:number, nextz:number, check:boolean):boolean {
  var z1 = (slope(x1, y1, heinum) + z) / SCALE; 
  var z2 = (slope(x2, y2, heinum) + z) / SCALE;
  var z3 = (nextslope(x2, y2, nextheinum) + nextz) / SCALE;
  var z4 = (nextslope(x1, y1, nextheinum) + nextz) / SCALE;
  if (check && (z4 >= z1 && z3 >= z2))
    return false;
  genWallQuad(x1, y1, x2, y2, z1, z2, z3, z4);
  return true;
}

function fillBuffersForMaskedWall(x1:number, y1:number, x2:number, y2:number, slope:any, nextslope:any, 
  ceilheinum:number, ceilnextheinum:number, ceilz:number, ceilnextz:number,
  floorheinum:number, floornextheinum:number, floorz:number, floornextz:number):void {
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
  genWallQuad(x1, y1, x2, y2, z1, z2, z3, z4);
}

function genWallQuad(x1:number, y1:number, x2:number, y2:number, z1:number, z2:number, z3:number, z4:number) {
  BGL.begin();
  BGL.vtx(x1, z1, y1); BGL.vtx(x2, z2, y2); BGL.vtx(x2, z3, y2); BGL.vtx(x1, z4, y1);
  if (mode == MODE_WIREFRAME) {
    BGL.line(0, 1); BGL.line(1, 2); BGL.line(2, 3); BGL.line(3, 0);
  } else {
    if (z1 < z2) {
      BGL.triangle(0,2,1); BGL.triangle(0,3,2); 
    } else {
      BGL.triangle(0,3,1); BGL.triangle(1,3,2); 
    }
  }
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

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    fillBuffersForWall(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    var base = wall.cstat.alignBottom ? floorz : ceilingz;
    applyWallTextureTransform(wall, wall2, tex, base);
    BGLdraw(gl, tex, wall.shade, id);
  } else {
    var nextsector = board.sectors[wall.nextsector];
    var nextslope = U.createSlopeCalculator(nextsector, board.walls);
    var nextfloorz = nextsector.floorz;
    var nextceilingz = nextsector.ceilingz;

    var nextfloorheinum = nextsector.floorheinum;
    if (fillBuffersForWall(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true)) {
      var wall_ = wall.cstat.swapBottoms ? board.walls[wall.nextwall] : wall;
      var wall2_ = wall.cstat.swapBottoms ? board.walls[wall_.point2] : wall2;
      var tex_ = wall.cstat.swapBottoms ? artProvider.get(wall_.picnum) : tex;
      var base = wall.cstat.alignBottom ? ceilingz : nextfloorz;
      applyWallTextureTransform(wall_, wall2_, tex_, base, wall);
      BGLdraw(gl, tex_, wall_.shade, id);
    }

    var nextceilingheinum = nextsector.ceilingheinum;
    if (fillBuffersForWall(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true)) {
      var base = wall.cstat.alignBottom ? ceilingz : nextceilingz;
      applyWallTextureTransform(wall, wall2, tex, base);
      BGLdraw(gl, tex, wall.shade, id);
    }

    if (wall.cstat.masking) {
      var tex1 = artProvider.get(wall.overpicnum);
      fillBuffersForMaskedWall(x1, y1, x2, y2, slope, nextslope, 
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      var base = wall.cstat.alignBottom ? Math.min(floorz, nextfloorz) : Math.max(ceilingz, nextceilingz);
      applyWallTextureTransform(wall, wall2, tex1, base);
      BGLdraw(gl, tex1, wall.shade, id);
    }
  }
}

function fillbuffersForWallSprite(x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, ang:number, xf:number, yf:number, onesided:number) {
  var dx = Math.sin(ang)*hw;
  var dy = Math.cos(ang)*hw;
  BGL.begin();
  BGL.vtx(x-dx, z-hh+yo, y-dy);
  BGL.vtx(x+dx, z-hh+yo, y+dy);
  BGL.vtx(x+dx, z+hh+yo, y+dy);
  BGL.vtx(x-dx, z+hh+yo, y-dy);
  genSpriteQuad(onesided);

  var xf = xf ? -1.0 : 1.0;
  var yf = yf ? -1.0 : 1.0;
  var texMat = BGL.state.getTextureMatrix();
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [xf/(hw*2), -yf/(hh*2), 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -ang - Math.PI/2);
  GLM.mat4.translate(texMat, texMat, [-x-xf*dx, -z-yf*hh-yo, -y-xf*dy, 0]);
}

function fillbuffersForFloorSprite(x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, ang:number, xf:number, yf:number, onesided:number) {
  var dwx = Math.sin(-ang)*hw;
  var dwy = Math.cos(-ang)*hw;
  var dhx = Math.sin(-ang+Math.PI/2)*hh;
  var dhy = Math.cos(-ang+Math.PI/2)*hh;
  BGL.begin();
  BGL.vtx(x-dwx-dhx, z, y-dwy-dhy);
  BGL.vtx(x+dwx-dhx, z, y+dwy-dhy);
  BGL.vtx(x+dwx+dhx, z, y+dwy+dhy);
  BGL.vtx(x-dwx+dhx, z, y-dwy+dhy);
  genSpriteQuad(onesided);

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

function fillBuffersForFaceSprite(x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, xf:number, yf:number) {
  BGL.begin();
  BGL.normal(-hw, +hh+yo);
  BGL.vtx(x, z, y);
  BGL.normal(+hw, +hh+yo);
  BGL.vtx(x, z, y);
  BGL.normal(+hw, -hh+yo);
  BGL.vtx(x, z, y);
  BGL.normal(-hw, -hh+yo);
  BGL.vtx(x, z, y);
  genSpriteQuad(1);

  var texMat = BGL.state.getTextureMatrix();
  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [1/(hw*2), -1/(hh*2), 1, 1]);
  GLM.mat4.translate(texMat, texMat, [hw, -hh-yo, 0, 0]);
}

function genSpriteQuad(onesided:number) {
  if (mode == MODE_WIREFRAME) {
    BGL.line(0, 1); BGL.line(1, 2); BGL.line(2, 3); BGL.line(3, 0);
  } else {
    BGL.quad(0, 1, 2, 3);
    if (!onesided)    
      BGL.quad(3, 2, 1, 0);
  }
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

  gl.polygonOffset(-1, -8);
  if (spr.cstat.type == 0) { // face
    fillBuffersForFaceSprite(x, y, z, xo, yo, hw, hh, xf, yf);
    BGLdraw(gl, tex, spr.shade, id, true);
  } else if (spr.cstat.type == 1) { // wall
    fillbuffersForWallSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided);
    BGLdraw(gl, tex, spr.shade, id);
  } else if (spr.cstat.type == 2) { // floor
    fillbuffersForFloorSprite(x, y, z, xo, yo, hw, hh, ang, xf, yf, spr.cstat.onesided);
    BGLdraw(gl, tex, spr.shade, id);
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