import * as MU from '../../../../libs/mathutils';
import * as VEC from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import { Controller3D } from '../../../../modules/controller3d';
import * as INPUT from '../../../input';
import * as PROFILE from '../../../../modules/profiler';
import { Texture } from '../../../drawstruct';
import * as TEX from '../../../textures';
import * as BU from '../boardutils';
import * as VIS from '../boardvisitor';
import { Board, Sprite } from '../structs';
import * as U from '../utils';
import * as BUFF from './buffers';
import * as BGL from './buildgl';
import { ArtProvider, Cache } from './cache';
import { Renderable, Type } from './renderable';
import { BloodSprite } from '../bloodstructs';


export interface PalProvider extends ArtProvider {
  getPalTexture(): Texture;
  getPluTexture(): Texture;
}

function isUpperLink(spr: Sprite) {
  return spr.lotag == 11 || spr.lotag == 7 || spr.lotag == 9 || spr.lotag == 13;
}

function isLowerLink(spr: Sprite) {
  return spr.lotag == 12 || spr.lotag == 6 || spr.lotag == 10 || spr.lotag == 14;
}



var ceilingLinks = {}
var floorLinks = {}

function initRorLinks(board: Board) {
  var linkRegistry = {};
  for (var s = 0; s < board.sprites.length; s++) {
    var spr = board.sprites[s];
    if (isUpperLink(spr) || isLowerLink(spr)) {
      var id = (<BloodSprite>spr).extraData.data1;
      var links = linkRegistry[id];
      if (links == undefined) {
        links = [];
        linkRegistry[id] = links;
      }
      links.push(s);
    }
  }

  for (var linkId in linkRegistry) {
    var spriteIds = linkRegistry[linkId];
    if (spriteIds.length != 2)
      throw new Error('Invalid link in sprites: ' + spriteIds);
    var [s1, s2] = spriteIds;
    var spr1 = board.sprites[s1];
    var spr2 = board.sprites[s2];
    if (!isUpperLink(spr1)) {
      [s1, s2] = [s2, s1];
      [spr1, spr2] = [spr2, spr1];
    }
    if (board.sectors[spr1.sectnum].floorpicnum == 504)
      floorLinks[spr1.sectnum] = [s1, s2];
    if (board.sectors[spr2.sectnum].ceilingpicnum == 504)
      ceilingLinks[spr2.sectnum] = [s2, s1];
  }
}

var artProvider: PalProvider;
var cache: Cache;
export function init(gl: WebGLRenderingContext, art: PalProvider, board: Board, cb: () => void) {
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  artProvider = art;
  cache = new Cache(board, art);
  initRorLinks(board);
  BGL.init(gl, art.getPalTexture(), art.getPluTexture(), cb);
}

var selectType = -1;
var selectId = -1;
var gridSize = 128;

var hit = new U.Hitscan();
function hitscan(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  var [vx, vz, vy] = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  U.hitscan(board, artProvider, ms.x, ms.y, ms.z, ms.sec, vx, vy, -vz, hit, 0);
  if (INPUT.mouseClicks[0]) {
    if (hit.t == -1) {
      selectType = -1;
      selectId = -1;
    } else {
      selectType = hit.type;
      selectId = hit.id;
      switch (selectType) {
        case U.HitType.CEILING:
        case U.HitType.FLOOR:
          console.log(selectId, board.sectors[selectId]);
          break;
        case U.HitType.UPPER_WALL:
        case U.HitType.MID_WALL:
        case U.HitType.LOWER_WALL:
          console.log(selectId, board.walls[selectId]);
          break;
        case U.HitType.SPRITE:
          console.log(selectId, board.sprites[selectId]);
          break;
      }
    }
  }
}

function getClosestWall(board: Board): number {
  if (hit.t == -1)
    return -1;
  if (U.isWall(hit.type)) {
    return BU.closestWallInSector(board, U.sectorOfWall(board, hit.id), hit.x, hit.y, 128);
  } else if (U.isSector(hit.type)) {
    return BU.closestWallInSector(board, hit.id, hit.x, hit.y, 128);
  }
  return -1;
}

var movingz = 0;
var movingId = -1;
function move(gl: WebGLRenderingContext, board: Board, ctr: Controller3D) {
  var w = movingId == -1 ? getClosestWall(board) : movingId;
  if (w == -1) {
    BGL.setCursorPosiotion([0, 0, 0]);
    return;
  }

  BGL.setCursorPosiotion([board.walls[w].x, hit.z / -16, board.walls[w].y]);
  if (movingId == -1 && INPUT.mouseButtons[0]) {
    movingId = w;
    movingz = hit.z;
  }
  if (!INPUT.mouseButtons[0]) {
    movingId = -1;
  }

  if (movingId == -1)
    return;

  var fwd = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  var pos = ctr.getCamera().getPosition();
  var dz = movingz / -16 - pos[1];
  var t = dz / fwd[1];
  GLM.vec3.scale(fwd, fwd, t);
  var x = pos[0] + fwd[0];
  var y = pos[2] + fwd[2]
  BU.moveWall(board, movingId, snapGrid(x, gridSize), snapGrid(y, gridSize));
  cache.invalidateAll();
}

function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

function snap(board: Board) {
  if (hit.t != -1) {
    // var x = hit.x; var y = hit.y;
    // if (U.isSector(hit.type)) {
    //   x = snapGrid(x, gridSize);
    //   y = snapGrid(y, gridSize);
    // } else if (U.isWall(hit.type)) {
    //   var w = hit.id; 
    //   var wall = board.walls[w];
    //   var w1 = BU.nextwall(board, w); var wall1 = board.walls[w1];
    //   var dx = wall1.x - wall.x;
    //   var dy = wall1.y - wall.y;
    //   var repeat = 128 * wall.xrepeat;
    //   var dt = gridSize / repeat;
    //   var dxt = x - wall.x; var dyt = y - wall.y;
    //   var t = MU.len2d(dxt, dyt) / MU.len2d(dx, dy);
    //   t = (1 - t) < dt/2.0 ? 1 : snapGrid(t, dt);
    //   x = MU.int(wall.x + (t * dx));
    //   y = MU.int(wall.y + (t * dy));
    // }
    BGL.setCursorPosiotion([hit.x, hit.z / -16, hit.y]);
  }
}

export function draw(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clearStencil(0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  drawImpl(gl, board, ms, ctr);

  hitscan(gl, board, ms, ctr);
  move(gl, board, ctr);
  drawHelpers(gl, board);
  // snap(board);

  highlightSelected(gl, board);

  // if (U.isWall(selectType) && ctr.getKeys()['Q']) {
  //   selectId = BU.pushWall(board, selectId, -128, artProvider, []);
  //   cache.invalidateAll();
  // }
  // if (U.isWall(selectType) && ctr.getKeys()['E']) {
  //   selectId = BU.pushWall(board, selectId, 128, artProvider, []);
  //   cache.invalidateAll();
  // }
  if (U.isWall(selectType) && INPUT.keys['M']) {
    board.walls[selectId].picnum = 504;
    cache.invalidateWalls([selectId]);
  }
}

function createTexture(gl: WebGLRenderingContext): Texture {
  var img = new Uint8Array(16 * 16);
  for (var i = 0; i < 16; i++) {
    img[i] = 32; img[16 * i] = 32;
  }
  return TEX.createTexture(16, 16, gl, { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE }, img, gl.LUMINANCE);
}

var helper;
function createHelper(gl:WebGLRenderingContext) {
  if (helper != null)
    return;
  helper = cache.createRenderable();
  helper.buff.allocate(4, 12);
  helper.tex = createTexture(gl);
  helper.pal = 1;
  helper.trans = 0.5;
  helper.buff.writePos(0, -64000, 0, -64000);
  helper.buff.writePos(1, 64000, 0, -64000);
  helper.buff.writePos(2, 64000, 0, 64000);
  helper.buff.writePos(3, -64000, 0, 64000);
  helper.buff.writeQuad(0, 0, 1, 2, 3);
  helper.buff.writeQuad(6, 3, 2, 1, 0);
  var tmat = GLM.mat4.create();
  GLM.mat4.scale(tmat, tmat, [1 / 256, 1 / 256, 1, 1]);
  GLM.mat4.rotateX(tmat, tmat, Math.PI / 2);
  helper.texMat = tmat;
}

function drawHelpers(gl: WebGLRenderingContext, board: Board) {
  createHelper(gl);

  if (hit.t != -1 && U.isSector(hit.type)) {
    var z = (hit.type == U.HitType.CEILING ? board.sectors[hit.id].ceilingz : board.sectors[hit.id].floorz) / -16;
    helper.buff.writePos(0, -64000, z, -64000);
    helper.buff.writePos(1, 64000, z, -64000);
    helper.buff.writePos(2, 64000, z, 64000);
    helper.buff.writePos(3, -64000, z, 64000);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.STENCIL_TEST);
    writeStencilOnly(gl, 42);
    BGL.draw(gl, cache.getByIdType(hit.id, U.isWall(hit.id) ? U.sectorOfWall(board, hit.id) : -1, hit.type));
    writeStenciledOnly(gl, 42);
    BGL.draw(gl, helper);
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.DEPTH_TEST);
    writeAll(gl);
  }
}

function highlightSelected(gl: WebGLRenderingContext, board: Board) {
  gl.disable(gl.DEPTH_TEST);
  BGL.draw(gl, cache.getByIdType(selectId, U.isWall(selectType) ? U.sectorOfWall(board, selectId) : -1, selectType, true));
  gl.enable(gl.DEPTH_TEST);
}

function writeStencilOnly(gl: WebGLRenderingContext, value: number) {
  gl.stencilFunc(gl.ALWAYS, value, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.stencilMask(0xff);
  gl.depthMask(false);
  gl.colorMask(false, false, false, false);
}

function writeStenciledOnly(gl: WebGLRenderingContext, value: number) {
  gl.stencilFunc(gl.EQUAL, value, 0xff);
  gl.stencilMask(0x0);
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

function writeDepthOnly(gl: WebGLRenderingContext) {
  gl.colorMask(false, false, false, false);
}

function writeAll(gl: WebGLRenderingContext) {
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

function drawImpl(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  if (!U.inSector(board, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board, ms.x, ms.y, ms.sec);
  }

  PROFILE.startProfile('processing');
  var result = ms.sec == -1
    ? VIS.all(board)
    : VIS.visible(board, ms);
  PROFILE.endProfile();

  drawMirrors(gl, board, result, ms, ctr);
  drawRor(gl, board, result, ms, ctr);

  BGL.setViewMatrices(ctr.getProjectionMatrix(gl), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPosition());
  drawRooms(gl, board, result);
}


function drawStack(gl: WebGLRenderingContext, board: Board, ctr: Controller3D, src: Sprite, dst: Sprite, surface: Renderable, stencilValue: number) {
  BGL.setViewMatrices(ctr.getProjectionMatrix(gl), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPosition());
  writeStencilOnly(gl, stencilValue);
  BGL.draw(gl, surface);

  var diff = GLM.vec3.sub(GLM.vec3.create(), [src.x, src.z / -16, src.y], [dst.x, dst.z / -16, dst.y]);
  var stackTransform = GLM.mat4.clone(ctr.getCamera().getTransformMatrix());
  GLM.mat4.translate(stackTransform, stackTransform, diff);

  var ms = new U.MoveStruct();
  var position = ctr.getCamera().getPosition();
  ms.sec = dst.sectnum; ms.x = position[0] - diff[0]; ms.y = position[2] - diff[2]; ms.z = position[1] - diff[1];
  BGL.setViewMatrices(ctr.getProjectionMatrix(gl), stackTransform, [ms.x, ms.z, ms.y]);
  writeStenciledOnly(gl, stencilValue);
  drawRooms(gl, board, VIS.visible(board, ms));

  BGL.setViewMatrices(ctr.getProjectionMatrix(gl), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPosition());
  writeDepthOnly(gl);
  BGL.draw(gl, surface);
}

var rorSectorCollector = VIS.createSectorCollector((board: Board, sectorId: number) => floorLinks[sectorId] != undefined || ceilingLinks[sectorId] != undefined);

function drawRor(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forSector(board, rorSectorCollector.visit());

  gl.enable(gl.STENCIL_TEST);
  for (var i = 0; i < rorSectorCollector.sectors.length; i++) {
    var s = rorSectorCollector.sectors[i];
    var r = cache.getSector(s);

    if (ceilingLinks[s] != undefined) {
      var src = board.sprites[ceilingLinks[s][0]];
      var dst = board.sprites[ceilingLinks[s][1]];
      drawStack(gl, board, ctr, src, dst, r.ceiling, i + 1);
    }
    if (floorLinks[s] != undefined) {
      var src = board.sprites[floorLinks[s][0]];
      var dst = board.sprites[floorLinks[s][1]];
      drawStack(gl, board, ctr, src, dst, r.floor, i + 1);
    }
  }
  gl.disable(gl.STENCIL_TEST);
  writeAll(gl);
}

var mirrorWallsCollector = VIS.createWallCollector((board: Board, wallId: number, sectorId: number) => board.walls[wallId].picnum == 504);
function drawMirrors(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forWall(board, mirrorWallsCollector.visit());

  gl.enable(gl.STENCIL_TEST);
  var msMirrored = new U.MoveStruct();
  for (var i = 0; i < mirrorWallsCollector.walls.length; i++) {
    var w = mirrorWallsCollector.walls[i].wallId;
    var w1 = board.walls[w];
    var w2 = board.walls[w1.point2];
    if (!U.wallVisible(w1, w2, ms))
      continue;

    // draw mirror surface into stencil
    var r = cache.getWall(w, mirrorWallsCollector.walls[i].sectorId);
    BGL.setViewMatrices(ctr.getProjectionMatrix(gl), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPosition());
    writeStencilOnly(gl, i + 127);
    BGL.draw(gl, r);

    // draw reflections in stenciled area
    var wallNormal = VEC.normal2d(GLM.vec2.create(), [w2.x - w1.x, w2.y - w1.y]);
    var mirrorNormal = GLM.vec3.fromValues(wallNormal[0], 0, wallNormal[1]);
    var mirrorrD = -MU.dot2d(wallNormal[0], wallNormal[1], w1.x, w1.y);
    var mirroredTransform = VEC.mirrorBasis(GLM.mat4.create(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPosition(), mirrorNormal, mirrorrD);

    BGL.setViewMatrices(ctr.getProjectionMatrix(gl), mirroredTransform, ctr.getCamera().getPosition());
    BGL.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
    gl.cullFace(gl.FRONT);
    var mpos = VEC.reflectPoint3d(GLM.vec3.create(), mirrorNormal, mirrorrD, [ms.x, ms.z, ms.y]);
    msMirrored.sec = ms.sec; msMirrored.x = mpos[0]; msMirrored.y = mpos[2]; msMirrored.z = mpos[1];
    writeStenciledOnly(gl, i + 127);
    drawRooms(gl, board, VIS.visible(board, msMirrored));
    gl.cullFace(gl.BACK);

    // seal reflections by writing depth of mirror surface
    BGL.setViewMatrices(ctr.getProjectionMatrix(gl), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPosition());
    writeDepthOnly(gl);
    BGL.setClipPlane(0, 0, 0, 0);
    BGL.draw(gl, r);
  }
  gl.disable(gl.STENCIL_TEST);
  writeAll(gl);
}

function drawArray(gl: WebGLRenderingContext, arr: Renderable[]) {
  for (var i = 0; i < arr.length; i++) {
    BGL.draw(gl, arr[i]);
  }
}

function drawRooms(gl: WebGLRenderingContext, board: Board, result: VIS.Result) {
  var surfaces: Renderable[] = [];
  var surfacesTrans: Renderable[] = [];
  var sprites: Renderable[] = [];
  var spritesTrans: Renderable[] = [];

  result.forSector(board, (board: Board, sectorId: number) => {
    var sector = cache.getSector(sectorId);
    if (floorLinks[sectorId] == undefined)
      surfaces.push(sector.floor);
    if (ceilingLinks[sectorId] == undefined)
      surfaces.push(sector.ceiling);
    PROFILE.incCount('sectors');
  });
  result.forWall(board, (board: Board, wallId: number, sectorId: number) => {
    if (board.walls[wallId].picnum == 504)
      return;
    var wall = cache.getWall(wallId, sectorId);
    if (wall.mid.trans != 1) {
      surfacesTrans.push(wall.mid);
      surfaces.push(wall.bot, wall.top);
    } else {
      surfaces.push(wall);
    }
    PROFILE.incCount('walls');
  });
  result.forSprite(board, (board: Board, spriteId: number) => {
    var sprite = cache.getSprite(spriteId);
    var trans = sprite.trans != 1;
    (sprite.type == Type.FACE
      ? (trans ? spritesTrans : sprites)
      : (trans ? spritesTrans : sprites))
      .push(sprite);
    PROFILE.incCount('sprites');
  });
  PROFILE.set('buffer', BUFF.getFreeSpace());
  PROFILE.endProfile();

  PROFILE.startProfile('draw');

  drawArray(gl, surfaces);

  gl.polygonOffset(-1, -8);
  drawArray(gl, sprites);
  gl.polygonOffset(0, 0);

  drawArray(gl, surfacesTrans);

  gl.polygonOffset(-1, -8);
  drawArray(gl, spritesTrans);
  gl.polygonOffset(0, 0);

  PROFILE.endProfile();
}