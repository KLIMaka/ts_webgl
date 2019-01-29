import MB = require('../../../meshbuilder');
import DS = require('../../../drawstruct');
import BATCH = require('../../../batcher');
import SHADER = require('../../../shaders');
import BW = require('../buildwrapper');
import U = require('../utils');
import MU = require('../../../../libs/mathutils');
import C = require('../../../../modules/controller3d');
import VEC = require('../../../../libs/vecmath');
import BS = require('../structs');
import GLU = require('../../../../libs_js/glutess');
import GLM = require('../../../../libs_js/glmatrix');
import GL = require('../../../../modules/gl');

const SCALE = -16;

export interface ArtProvider {
  get(picnum:number):DS.Texture;
  getInfo(picnum:number):number;
}

export function init(gl:WebGLRenderingContext, p:ArtProvider) {
  createBuffers(gl);
  initShaders(gl);
  setArtProvider(p);
}

var artProvider:ArtProvider = null;
function setArtProvider(p:ArtProvider) {
  artProvider = p;
}

var idxs = new Uint16Array(1024);
var idxBuf:MB.DynamicIndexBuffer;
var idxsLength = 0;
var pos = new Float32Array(4096);
var posBuf:MB.VertexBufferDynamic;
function createBuffers(gl:WebGLRenderingContext) {
  posBuf = MB.wrap(gl, pos, 3);
  idxBuf = MB.wrapIndexBuffer(gl, idxs);
}

function quad(
  x1:number, y1:number, z1:number,
  x2:number, y2:number, z2:number,
  x3:number, y3:number, z3:number,
  x4:number, y4:number, z4:number, twosided:boolean=false):void {
  var posoff = 0;
  pos[posoff++] = x1; pos[posoff++] = y1; pos[posoff++] = z1;
  pos[posoff++] = x2; pos[posoff++] = y2; pos[posoff++] = z2;
  pos[posoff++] = x3; pos[posoff++] = y3; pos[posoff++] = z3;
  pos[posoff++] = x4; pos[posoff++] = y4; pos[posoff++] = z4;
  var idxoff = 0;
  idxs[idxoff++] = 0; idxs[idxoff++] = 2; idxs[idxoff++] = 1;
  idxs[idxoff++] = 0; idxs[idxoff++] = 3; idxs[idxoff++] = 2;
  if (twosided) {
    idxs[idxoff++] = 1; idxs[idxoff++] = 2; idxs[idxoff++] = 0;
    idxs[idxoff++] = 2; idxs[idxoff++] = 3; idxs[idxoff++] = 0;
  }
  idxsLength = idxoff;
}

var baseShader:DS.Shader;
var selectShader:DS.Shader;
function initShaders(gl:WebGLRenderingContext) {
  baseShader = SHADER.createShader(gl, 'resources/shaders/build_base1');
  selectShader = SHADER.createShader(gl, 'resources/shaders/build_base1', ['SELECT']);
}

var selectDraw = 0;
var selectedId = -1;
function startBase(gl:WebGLRenderingContext, ctr:C.Controller3D) {
  var shader = selectDraw ? selectShader : baseShader;
  gl.useProgram(shader.getProgram());
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf.getBuffer());
  var location = shader.getAttributeLocation('aPos', gl);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, posBuf.getSpacing(), posBuf.getType(), posBuf.getNormalized(), posBuf.getStride(), posBuf.getOffset());
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
  gl.uniformMatrix4fv(shader.getUniformLocation('MVP', gl), false, ctr.getMatrix());
  gl.uniformMatrix4fv(shader.getUniformLocation('MV', gl), false, ctr.getModelViewMatrix());
  gl.uniformMatrix4fv(shader.getUniformLocation('P', gl), false, ctr.getProjectionMatrix());
  gl.uniform3fv(shader.getUniformLocation('eyepos', gl), ctr.getCamera().getPos());
  gl.uniform1i(shader.getUniformLocation('selectedId', gl), selectedId);
}

var texMat = GLM.mat4.create();
function drawFace(gl:WebGLRenderingContext, tex:DS.Texture, texMat:number[], shade:number, id:number) {
  var shader = selectDraw ? selectShader : baseShader;
  idxBuf.update(gl);
  posBuf.update(gl);
  gl.bindTexture(gl.TEXTURE_2D, tex.get());
  gl.uniform1i(shader.getUniformLocation('currentId', gl), id);
  gl.uniform1i(shader.getUniformLocation('shade', gl), shade);
  gl.uniformMatrix4fv(shader.getUniformLocation('texMat', gl), false, texMat);
  gl.drawElements(gl.TRIANGLES, idxsLength, gl.UNSIGNED_SHORT, 0);
}

function getSectorTextureTransform(sector:BS.Sector, ceiling:boolean, walls:BS.Wall[], tex:DS.Texture):GLM.Mat4Array {
  var xpan = ceiling ? sector.ceilingxpanning : sector.floorxpanning;
  var ypan = ceiling ? sector.ceilingypanning : sector.floorypanning;
  var stats = ceiling ? sector.ceilingstat : sector.floorstat;
  var scale = stats.doubleSmooshiness ? 8.0 : 16.0;
  var tcscalex = (stats.xflip ? -1.0 :  1.0) / (tex.getWidth() * scale);
  var tcscaley = (stats.yflip ? -1.0 :  1.0) / (tex.getHeight() * scale);
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
  return texMat;
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

function fillBuffersForSector(ceil:boolean, board:BS.Board, sec:BS.Sector, vtxs:number[], vidxs:number[]) {
  var heinum = ceil ? sec.ceilingheinum : sec.floorheinum;
  var z = ceil ? sec.ceilingz : sec.floorz;
  var slope = U.createSlopeCalculator(sec, board.walls);

  var posoff = 0;
  for (var i = 0; i < vtxs.length; i++) {
    var vx = vtxs[i][0];
    var vy = vtxs[i][1];
    var vz = (slope(vx, vy, heinum) + z) / SCALE;
    pos[posoff++] = vx;
    pos[posoff++] = vz;
    pos[posoff++] = vy;
  }

  var idxoff = 0;
  for (var i = 0; i < vidxs.length; i+=3) {
    if (ceil) {
      idxs[idxoff++] = vidxs[i+0];
      idxs[idxoff++] = vidxs[i+1];
      idxs[idxoff++] = vidxs[i+2];
    } else {
      idxs[idxoff++] = vidxs[i+2];
      idxs[idxoff++] = vidxs[i+1];
      idxs[idxoff++] = vidxs[i+0];
    }
  }
  idxsLength = idxoff;
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

function drawSector(gl:WebGLRenderingContext, board:BS.Board, sec:BS.Sector, id:number) {
  var [vtxs, vidxs] = cacheTriangulate(board, sec);

  fillBuffersForSector(true, board, sec, vtxs, vidxs);
  var tex = artProvider.get(sec.ceilingpicnum);
  var texMat = getSectorTextureTransform(sec, true, board.walls, tex);
  drawFace(gl, tex, texMat, sec.ceilingshade, id);

  fillBuffersForSector(false, board, sec, vtxs, vidxs);
  var tex = artProvider.get(sec.floorpicnum);
  var texMat = getSectorTextureTransform(sec, false, board.walls, tex);
  drawFace(gl, tex, texMat, sec.floorshade, id);
}


function fillBuffersForWall(x1:number, y1:number, x2:number, y2:number, slope:any, nextslope:any, heinum:number, nextheinum:number, z:number, nextz:number, check:boolean):boolean {
  var z1 = (slope(x1, y1, heinum) + z) / SCALE; 
  var z2 = (slope(x2, y2, heinum) + z) / SCALE;
  var z3 = (nextslope(x2, y2, nextheinum) + nextz) / SCALE;
  var z4 = (nextslope(x1, y1, nextheinum) + nextz) / SCALE;
  if (check && (z4 >= z1 && z3 >= z2))
    return false;
  quad(x1, z1, y1, x2, z2, y2, x2, z3, y2, x1, z4, y1);
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
  quad(x1, z1, y1, x2, z2, y2, x2, z3, y2, x1, z4, y1);
}

function getWallTextureTransform(wall:BS.Wall, wall2:BS.Wall, tex:DS.Texture, base:number):GLM.Mat4Array {
  var wall1 = wall;
  if (wall.cstat.xflip)
    [wall1, wall2] = [wall2, wall1];
  var tw = tex.getWidth();
  var th = tex.getHeight();
  var dx = wall2.x - wall1.x;
  var dy = wall2.y - wall1.y;
  var tcscalex = (wall.xrepeat * 8.0) / (MU.len2d(dx, dy) * tw);
  var tcscaley = -(wall.yrepeat / 8.0) / (th * 16.0);
  var tcxoff = wall.xpanning / tw;
  var tcyoff = wall.ypanning / 256.0;

  GLM.mat4.identity(texMat);
  GLM.mat4.translate(texMat, texMat, [tcxoff, tcyoff, 0, 0]);
  GLM.mat4.scale(texMat, texMat, [tcscalex, tcscaley, 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
  GLM.mat4.translate(texMat, texMat, [-wall1.x, -base / SCALE, -wall1.y, 0]);
  return texMat;
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
    var trans = getWallTextureTransform(wall, wall2, tex, base);
    drawFace(gl, tex, trans, wall.shade, id);
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
      var trans = getWallTextureTransform(wall_, wall2_, tex_, base);
      drawFace(gl, tex_, trans, wall_.shade, id);
    }

    var nextceilingheinum = nextsector.ceilingheinum;
    if (fillBuffersForWall(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true)) {
      var base = wall.cstat.alignBottom ? ceilingz : nextceilingz;
      var trans = getWallTextureTransform(wall, wall2, tex, base);
      drawFace(gl, tex, trans, wall.shade, id);
    }

    if (wall.cstat.masking) {
      var tex1 = artProvider.get(wall.overpicnum);
      fillBuffersForMaskedWall(x1, y1, x2, y2, slope, nextslope, 
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      var base = wall.cstat.alignBottom ? Math.min(floorz, nextfloorz) : Math.max(ceilingz, nextceilingz);
      var trans = getWallTextureTransform(wall, wall2, tex1, base);
      drawFace(gl, tex1, trans, wall.shade, id);
    }
  }
}

function fillbuffersForWallSprite(x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, ang:number, onesided:number):GLM.Mat4Array {
  var dx = Math.sin(ang)*hw;
  var dy = Math.cos(ang)*hw;
  quad(
    x-dx, z-hh+yo, y-dy,
    x+dx, z-hh+yo, y+dy,
    x+dx, z+hh+yo, y+dy,
    x-dx, z+hh+yo, y-dy, !onesided);

  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [1/(hw*2), -1/(hh*2), 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, ang + Math.PI/2);
  GLM.mat4.translate(texMat, texMat, [-x-dx, -z-hh-yo, -y-dy, 0]);
  return texMat;
}

function fillbuffersForFloorSprite(x:number, y:number, z:number, xo:number, yo:number, hw:number, hh:number, ang:number, onesided:number) {
  var dwx = Math.sin(ang)*hw;
  var dwy = Math.cos(ang)*hw;
  var dhx = Math.sin(ang+Math.PI/2)*hh;
  var dhy = Math.cos(ang+Math.PI/2)*hh;
  quad(
    x-dwx-dhx, z+1, y-dwy-dhy,
    x+dwx+dhx, z+1, y-dwy-dhy,
    x+dwx+dhx, z+1, y+dwy+dhy,
    x-dwx-dhx, z+1, y+dwy+dhy, !onesided);

  GLM.mat4.identity(texMat);
  GLM.mat4.scale(texMat, texMat, [1/(hw*2), 1/(hh*2), 1, 1]);
  GLM.mat4.rotateY(texMat, texMat, ang);
  GLM.mat4.translate(texMat, texMat, [-x-dwx-dhx, -z-1, -y-dwy-dhy, 0]);
  GLM.mat4.rotateX(texMat, texMat, -Math.PI/2);
  return texMat;
}

function drawSprite(gl:WebGLRenderingContext, board:BS.Board, spr:BS.Sprite, id:number) {
  if (spr.picnum == 0 || spr.cstat.invicible)
    return;

  var tex = artProvider.get(spr.picnum);
  var tinfo = artProvider.getInfo(spr.picnum);
  var x = spr.x; var y = spr.y; var z = spr.z / SCALE;
  var w = tex.getWidth(); var hw = (w*spr.xrepeat) / 8;
  var h = tex.getHeight(); var hh = (h*spr.yrepeat) / 8;
  var ang = MU.PI2 - (spr.ang / 2048) * MU.PI2;
  var xo = MU.ubyte2byte((tinfo >> 8) & 0xFF)*16 * (spr.xrepeat/64);
  var yo = MU.ubyte2byte((tinfo >> 16) & 0xFF)*16 * (spr.yrepeat/64);

  if (spr.cstat.type == 0) { // face
    // var pos = [x, z, y];
    // var a = [+hw, -hh+yo, 0];
    // var b = [-hw, -hh+yo, 0];
    // var c = [-hw, +hh+yo, 0];
    // var d = [+hw, +hh+yo, 0];
    // vtxs = [a, b, c, d];
    // mat = materials.sprite(tex);
    // var bbox = MU.bbox(vtxs);
    // builder.begin();
    // builder.addSprite(vtxs, pos, tcs, idx, spr.shade);
    // var mesh = builder.end(mat);
    // return new SpriteInfo(bbox, mesh, true);
  } else if (spr.cstat.type == 1) { // wall
    var trans = fillbuffersForWallSprite(x, y, z, xo, yo, hw, hh, ang, spr.cstat.onesided);
    drawFace(gl, tex, trans, spr.shade, id);
  } else if (spr.cstat.type == 2) { // floor
    var trans = fillbuffersForFloorSprite(x, y, z, xo, yo, hw, hh, ang, spr.cstat.onesided);
    drawFace(gl, tex, trans, spr.shade, id);
  }
}

function drawInSector(gl:WebGLRenderingContext, board:BW.BoardWrapper, ms:U.MoveStruct, ctr:C.Controller3D) {
  startBase(gl, ctr);
  var t = MU.int(window.performance.now());
  board.markVisible(ms, t);
  var sectors = board.markedSectors(t);
  for (var sec = sectors(); sec != null; sec = sectors()) {
    drawSector(gl, board.ref, sec.ref, sec.id);
  }
  var walls = board.markedWalls(t);
  for (var wall = walls(); wall != null; wall = walls()) {
    drawWall(gl, board.ref, wall.ref, wall.id, wall.sector.ref);
  }
  var sprites = board.markedSprites(t);
  for (var spr = sprites(); spr != null; spr = sprites()) {
    drawSprite(gl, board.ref, spr.ref, spr.id);
  }
}

function drawAll(gl:WebGLRenderingContext, board:BW.BoardWrapper, ctr:C.Controller3D) {
  var sectors = board.allSectors();
  startBase(gl, ctr);
  for (var sec = sectors(); sec != null; sec = sectors()) {
    drawSector(gl, board.ref, sec.ref, sec.id);
  }
  var walls = board.allWalls();
  for (var wall = walls(); wall != null; wall = walls()) {
    drawWall(gl, board.ref, wall.ref, wall.id, wall.sector.ref);
  }
}

export function draw(gl:WebGLRenderingContext, board:BW.BoardWrapper, ms:U.MoveStruct, ctr:C.Controller3D) {
  selectDraw = 1;
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawImpl(gl, board, ms, ctr);
  selectedId = GL.readId(gl, ctr.getX(), ctr.getY());
  if (ctr.isClick()) {
    console.log(board.id2object[selectedId]);
  }

  selectDraw = 0;
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawImpl(gl, board, ms, ctr);
}

function drawImpl(gl:WebGLRenderingContext, board:BW.BoardWrapper, ms:U.MoveStruct, ctr:C.Controller3D) {
  if (!U.inSector(board.ref, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board.ref, ms.x, ms.y, ms.sec);
  }
  if (ms.sec == -1) {
    drawAll(gl, board, ctr);
  } else {
    drawInSector(gl, board, ms, ctr);
  }
}