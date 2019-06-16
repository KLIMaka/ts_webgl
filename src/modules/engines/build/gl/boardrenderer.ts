import * as MU from '../../../../libs/mathutils';
import * as VEC from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import { Controller3D } from '../../../../modules/controller3d';
import * as PROFILE from '../../../../modules/profiler';
import { Texture } from '../../../drawstruct';
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
  getPalTexture():Texture;
  getPluTexture():Texture;
}


var upStacks = {}
var downStacks = {}
function initRorLinks(board:Board) {
  var linkRegistry = {};
  for (var s = 0; s < board.sprites.length; s++) {
    var spr = board.sprites[s];
    if (spr.lotag == 11 || spr.lotag == 12) {
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
    [s1, s2] = spr1.lotag == 11 ? [s1, s2] : [s2, s1];
    [spr1, spr2] = spr1.lotag == 11 ? [spr1, spr2] : [spr2, spr1];
    downStacks[spr1.sectnum] = [s1, s2];
    upStacks[spr2.sectnum] = [s2, s1];
  }
}

var artProvider:PalProvider;
var cache:Cache;
export function init(gl:WebGLRenderingContext, art:PalProvider, board:Board, cb:()=>void) {
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
function hitscan(board:Board, ms:U.MoveStruct, ctr:Controller3D) {
  var [vx, vz, vy] = ctr.getForwardMouse();
  U.hitscan(board, artProvider, ms.x, ms.y, ms.z, ms.sec, vx, vy, -vz, hit, 0);
  if (ctr.isClick()) {
    if (hit.t == -1) {
      selectType = -1;
      selectId = -1;
    } else {
      selectType = hit.type;
      selectId = hit.id;
      console.log(selectId);
    }
  }
}

function snapGrid(coord:number, gridSize:number):number {
  return Math.round(coord / gridSize) * gridSize;
}

function snap(board:Board) {
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
    BGL.setCursorPosiotion([hit.x, hit.z/-16, hit.y]);
  }
}

export function draw(gl:WebGLRenderingContext, board:Board, ms:U.MoveStruct, ctr:Controller3D) {
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clearStencil(0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  drawImpl(gl, board, ms, ctr);

  // hitscan(board, ms, ctr);
  // snap(board);

  // highlightSelected(gl, board);

  // if (U.isWall(selectType) && ctr.getKeys()['Q']) {
  //   selectId = BU.pushWall(board, selectId, -128, artProvider, []);
  //   cache.invalidateAll();
  // }
  // if (U.isWall(selectType) && ctr.getKeys()['E']) {
  //   selectId = BU.pushWall(board, selectId, 128, artProvider, []);
  //   cache.invalidateAll();
  // }
  // if (U.isWall(selectType) && ctr.getKeys()['M']) {
  //   board.walls[selectId].picnum = 504;
  // }
}

function highlightSelected(gl:WebGLRenderingContext, board:Board) {
  gl.disable(gl.DEPTH_TEST);
  switch (selectType) {
    case U.HitType.CEILING:
      BGL.draw(gl, cache.getSectorWireframe(selectId).ceiling);
      break;
    case U.HitType.FLOOR:
      BGL.draw(gl, cache.getSectorWireframe(selectId).floor);
      break;
    case U.HitType.UPPER_WALL:
      BGL.draw(gl, cache.getWallWireframe(selectId, BU.findSector(board, selectId)).top);
      break;
    case U.HitType.MID_WALL:
      BGL.draw(gl, cache.getWallWireframe(selectId, BU.findSector(board, selectId)).mid);
      break;
    case U.HitType.LOWER_WALL:
      BGL.draw(gl, cache.getWallWireframe(selectId, BU.findSector(board, selectId)).bot);
      break;
    case U.HitType.SPRITE:
      BGL.draw(gl, cache.getSpriteWireframe(selectId));
      break;
  }
  gl.enable(gl.DEPTH_TEST);
}

function writeStencilOnly(gl:WebGLRenderingContext, value:number) {
  gl.stencilFunc(gl.ALWAYS, value, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.stencilMask(0xff);
  gl.depthMask(false);
  gl.colorMask(false, false, false, false);
}

function writeStenciledOnly(gl:WebGLRenderingContext, value:number) {
  gl.stencilFunc(gl.EQUAL, value, 0xff);
  gl.stencilMask(0x0);
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

function writeDepthOnly(gl:WebGLRenderingContext) {
  gl.colorMask(false, false, false, false);
}

function drawImpl(gl:WebGLRenderingContext, board:Board, ms:U.MoveStruct, ctr:Controller3D) {
  if (!U.inSector(board, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board, ms.x, ms.y, ms.sec);
  }

  PROFILE.startProfile('processing');
  var result = ms.sec == -1 
    ? VIS.all(board) 
    : VIS.visible(board, ms);

  drawMirrors(gl, board, result, ms, ctr);
  drawRor(gl, board, result, ms, ctr);

  BGL.setViewMatrices(ctr.getProjectionMatrix(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPos());
  drawRooms(gl, board, result);
}

var rorSectorCollector = VIS.createSectorCollector((board:Board, sectorId:number) => {
  var sector = board.sectors[sectorId];
  return (sector.floorpicnum == 504 && downStacks[sectorId] != undefined) 
  || (sector.ceilingpicnum == 504 && upStacks[sectorId] != undefined);
});

function drawStack(gl:WebGLRenderingContext, board:Board, ctr:Controller3D, src:Sprite, dst:Sprite, surface:Renderable, stencilValue:number) {
  BGL.setViewMatrices(ctr.getProjectionMatrix(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPos());
  writeStencilOnly(gl, stencilValue);
  BGL.draw(gl, surface);

  var diff = GLM.vec3.sub(GLM.vec3.create(), [src.x, src.z/-16, src.y], [dst.x, dst.z/-16, dst.y]);
  var stackTransform = GLM.mat4.clone(ctr.getCamera().getTransformMatrix());
  GLM.mat4.translate(stackTransform, stackTransform, diff);

  var ms = new U.MoveStruct();
  var position = ctr.getCamera().getPos();
  ms.sec = dst.sectnum; ms.x = position[0]-diff[0]; ms.y = position[2]-diff[2]; ms.z = position[1]-diff[1];
  BGL.setViewMatrices(ctr.getProjectionMatrix(), stackTransform, [ms.x, ms.z, ms.y]);
  writeStenciledOnly(gl, stencilValue);
  drawRooms(gl, board, VIS.visible(board, ms));

  BGL.setViewMatrices(ctr.getProjectionMatrix(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPos());
  writeDepthOnly(gl);
  BGL.draw(gl, surface);
}

function drawRor(gl:WebGLRenderingContext, board:Board, result:VIS.Result, ms:U.MoveStruct, ctr:Controller3D) {
  result.forSector(board, rorSectorCollector.visit());

  gl.enable(gl.STENCIL_TEST);
  for (var i = 0; i < rorSectorCollector.sectors.length; i++) {
    var s = rorSectorCollector.sectors[i];
    var sector = board.sectors[s];

    if (upStacks[s] != undefined) {
      var src = board.sprites[upStacks[s][0]];
      var dst = board.sprites[upStacks[s][1]];
      var r = cache.getSector(s);
      drawStack(gl, board, ctr, src, dst, r.ceiling, i+1);
    }
    if (downStacks[s] != undefined) {
      var src = board.sprites[downStacks[s][0]];
      var dst = board.sprites[downStacks[s][1]];
      var r = cache.getSector(s);
      drawStack(gl, board, ctr, src, dst, r.floor, i+1); 
    }
  }
  gl.disable(gl.STENCIL_TEST);
  gl.colorMask(true, true, true, true);
}

var mirrorWallsCollector = VIS.createWallCollector((board:Board, wallId:number, sectorId:number) => {
  return board.walls[wallId].picnum == 504;
});


function drawMirrors(gl:WebGLRenderingContext, board:Board, result:VIS.Result, ms:U.MoveStruct, ctr:Controller3D) {
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
    BGL.setViewMatrices(ctr.getProjectionMatrix(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPos());
    writeStencilOnly(gl, i+127);
    BGL.draw(gl, r);

    // draw reflections in stenciled area
    var wallNormal = VEC.normal2d(GLM.vec2.create(), [w2.x-w1.x, w2.y-w1.y]);
    var mirrorNormal = GLM.vec3.fromValues(wallNormal[0], 0, wallNormal[1]);
    var mirrorrD = -MU.dot2d(wallNormal[0], wallNormal[1], w1.x, w1.y);
    var mirroredTransform = VEC.mirrorBasis(GLM.mat4.create(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPos(), mirrorNormal, mirrorrD);

    BGL.setViewMatrices(ctr.getProjectionMatrix(), mirroredTransform, ctr.getCamera().getPos());
    BGL.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
    gl.cullFace(gl.FRONT);
    var mpos = VEC.reflectPoint3d(GLM.vec3.create(), mirrorNormal, mirrorrD, [ms.x, ms.z, ms.y]);
    msMirrored.sec = ms.sec; msMirrored.x = mpos[0]; msMirrored.y = mpos[2]; msMirrored.z = mpos[1];
    writeStenciledOnly(gl, i+127);
    drawRooms(gl, board, VIS.visible(board, msMirrored));
    gl.cullFace(gl.BACK);

    // seal reflections by writing depth of mirror surface
    BGL.setViewMatrices(ctr.getProjectionMatrix(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPos());
    writeDepthOnly(gl);
    BGL.setClipPlane(0, 0, 0, 0);
    BGL.draw(gl, r);
  }
  gl.disable(gl.STENCIL_TEST);
  gl.colorMask(true, true, true, true);
}

function drawArray(gl:WebGLRenderingContext, arr:Renderable[]) {
  for (var i = 0; i < arr.length; i++) {
    BGL.draw(gl, arr[i]);
  }
}

function drawRooms(gl:WebGLRenderingContext, board:Board, result:VIS.Result) {
  var surfaces:Renderable[] = [];
  var surfacesTrans:Renderable[] = [];
  var sprites:Renderable[] = [];
  var spritesTrans:Renderable[] = [];

  result.forSector(board, (board:Board, sectorId:number) => {
    var sector = cache.getSector(sectorId);
    if (board.sectors[sectorId].floorpicnum != 504)
      surfaces.push(sector.floor);
    if (board.sectors[sectorId].ceilingpicnum != 504)
      surfaces.push(sector.ceiling);
    PROFILE.incCount('sectors');
  });
  result.forWall(board, (board:Board, wallId:number, sectorId:number) => {
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
  result.forSprite(board, (board:Board, spriteId:number) => {
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