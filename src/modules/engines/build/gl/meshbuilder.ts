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

const SCALE = -16;

export interface ArtProvider {
  get(picnum:number):DS.Texture;
  getInfo(picnum:number):number;
}

var artProvider:ArtProvider = null;
export function setArtProvider(p:ArtProvider) {
	artProvider = p;
}

export function init(gl:WebGLRenderingContext) {
	createBuffers(gl);
}

var idxs = new Uint16Array(1024);
var idxBuf:MB.DynamicIndexBuffer;
var pos = new Float32Array(4096);
var posBuf:MB.VertexBufferDynamic;

function createBuffers(gl:WebGLRenderingContext) {
	posBuf = MB.wrap(gl, pos, 3);
	idxBuf = MB.wrapIndexBuffer(gl, idxs);
}

var baseShader:DS.Shader;

function initShaders(gl:WebGLRenderingContext) {
	baseShader = SHADER.createShader(gl, 'resources/shaders/build_base');
}

export function startBase(gl:WebGLRenderingContext, ctr:C.Controller3D) {
	gl.useProgram(baseShader.getProgram());
	gl.bindBuffer(gl.ARRAY_BUFFER, posBuf.getBuffer());
	var location = baseShader.getAttributeLocation('aPos', gl);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, posBuf.getSpacing(), posBuf.getType(), posBuf.getNormalized(), posBuf.getStride(), posBuf.getOffset());
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
  gl.uniformMatrix4fv(baseShader.getUniformLocation('MVP', gl), false, ctr.getMatrix());
  gl.uniformMatrix4fv(baseShader.getUniformLocation('MV', gl), false, ctr.getModelViewMatrix());
  gl.uniformMatrix4fv(baseShader.getUniformLocation('P', gl), false, ctr.getProjectionMatrix());
  gl.uniform3fv(baseShader.getUniformLocation('eyepos', gl), ctr.getCamera().getPos());
}

function drawFace(gl:WebGLRenderingContext, tex:DS.Texture, texMat:number[], shade:number) {
	idxBuf.update(gl);
	posBuf.update(gl);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(baseShader.getUniformLocation('shade', gl), shade);
  gl.uniformMatrix3fv(baseShader.getUniformLocation('texMat', gl), false, texMat);
  gl.drawElements(gl.TRIANGLES, idxs.length, gl.UNSIGNED_SHORT, 0);
}

function applyAlignToFirsWall(trans:VEC.mat2d_t, sector:BS.Sector, walls:BS.Wall[]):VEC.mat2d_t {
  var w1 = walls[sector.wallptr];
  trans = VEC.translate2dTransform(trans, [-w1.x, -w1.y]);
  return VEC.rotate2dTransform(trans, U.getFirstWallAngle(sector, walls));
}

function getTextureTransform(sector:BS.Sector, ceiling:boolean, walls:BS.Wall[], tex:DS.Texture):VEC.mat2d_t {
  var xpan = ceiling ? sector.ceilingxpanning : sector.floorxpanning;
  var ypan = ceiling ? sector.ceilingypanning : sector.floorypanning;
  var stats = ceiling ? sector.ceilingstat : sector.floorstat;
  var scale = stats.doubleSmooshiness ? 8.0 : 16.0;
  var tcscalex = (stats.xflip ? -1.0 :  1.0) / (tex.getWidth() * scale);
  var tcscaley = (stats.yflip ? -1.0 :  1.0) / (tex.getHeight() * scale);
  var trans = VEC.create2dTransform();
  if (stats.alignToFirstWall) {
    trans = applyAlignToFirsWall(trans, sector, walls);
  }
  if (stats.swapXY) {
    trans = VEC.swapXY2dTransform(trans);
  }
  trans = VEC.scale2dTransform(trans, [tcscalex, tcscaley]);
  trans = VEC.translate2dTransform(trans, [xpan / 256.0, ypan / 256.0]);
  return trans;
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
  var shade = ceil ? sec.ceilingshade : sec.floorshade;
  var slope = U.createSlopeCalculator(sec, board.walls);

  var posoff = 0;
  for (var i = 0; i < vtxs.length; i+=2) {
  	var vx = vtxs[i+0];
  	var vy = vtxs[i+1];
  	var vz = (slope(vx, vy, heinum) + z) / SCALE;
  	pos[posoff++] = vx;
  	pos[posoff++] = vz;
  	pos[posoff++] = vy;
  }

  var idxoff = 0;
  for (var i = 0; i < vidxs.length; i+=3) {
  	if (ceil) {
  		idxs[idxoff++] = vidxs[i+2];
  		idxs[idxoff++] = vidxs[i+1];
  		idxs[idxoff++] = vidxs[i+0];
  	} else {
  		idxs[idxoff++] = vidxs[i+0];
  		idxs[idxoff++] = vidxs[i+1];
  		idxs[idxoff++] = vidxs[i+2];
  	}
  }
}

function fillWallVtxs(x1:number, y1:number, x2:number, y2:number, slope:any, nextslope:any, heinum:number, nextheinum:number, z:number, nextz:number, check:boolean):boolean {
  var z1 = (slope(x1, y1, heinum) + z) / SCALE; 
  var z2 = (slope(x2, y2, heinum) + z) / SCALE;
  var z3 = (nextslope(x2, y2, nextheinum) + nextz) / SCALE;
  var z4 = (nextslope(x1, y1, nextheinum) + nextz) / SCALE;
  if (check && (z4 >= z1 && z3 >= z2))
    return false;
  var posoff = 0;
  pos[posoff++] = x1; pos[posoff++] = z1; pos[posoff++] = y1;
  pos[posoff++] = x2; pos[posoff++] = z2; pos[posoff++] = y2;
  pos[posoff++] = x2; pos[posoff++] = z3; pos[posoff++] = y2;
  pos[posoff++] = x1; pos[posoff++] = z4; pos[posoff++] = y1;
  return true;
}

function drawSector(gl:WebGLRenderingContext, board:BS.Board, sec:BS.Sector) {
	var [vtxs, vidxs] = triangulate(sec, board.walls);

	fillBuffersForSector(true, board, sec, vtxs, vidxs);
	var tex = artProvider.get(sec.ceilingpicnum);
  var texMat = getTextureTransform(sec, true, board.walls, tex);
  drawFace(gl, tex, texMat, sec.ceilingshade);

  fillBuffersForSector(false, board, sec, vtxs, vidxs);
	var tex = artProvider.get(sec.floorpicnum);
  var texMat = getTextureTransform(sec, false, board.walls, tex);
  drawFace(gl, tex, texMat, sec.floorshade);
}

function drawWall(gl:WebGLRenderingContext, board:BS.Board, wall:BS.Wall) {
  var wall2 = board.walls[wall.point2];
  var x1 = wall.x;
  var y1 = wall.y;
  var x2 = wall2.x;
  var y2 = wall2.y;
  var tex = artProvider.get(wall.picnum);

   if (wall.nextwall == -1 || wall.cstat.oneWay) {
    var vtxs = getWallVtxs(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    var base = wall.cstat.alignBottom ? floorz : ceilingz;
    var solid = addWall(wall, builder, vtxs, idx, tex, materials.solid(tex), base / SCALE);
    this.walls[w] = new WallInfo(solid, null, null);
  }
}

export function draw(gl:WebGLRenderingContext, board:BW.BoardWrapper, ms:U.MoveStruct, ctr:C.Controller3D) {
	var t = MU.int(window.performance.now());
	board.markVisible(ms, t);
	var sectors = board.markedSectors(t);
	startBase(gl, ctr);
	for (var sec = sectors(); sec != null; sec = sectors()) {
		drawSector(gl, board.ref, sec.ref);
	}
	var walls = board.markedWalls(t);
	for (var wall = walls(); wall != null; wall = walls()) {
		drawWall(gl, board.ref, wall.ref);
	}
}