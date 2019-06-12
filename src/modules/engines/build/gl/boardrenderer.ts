import {Board, Sector, Wall, Sprite} from '../structs';
import {Renderable, Type} from './renderable';
import {Cache, ArtProvider} from './cache';
import * as DS from '../../../drawstruct';
import * as U from '../utils';
import * as C from '../../../../modules/controller3d';
import * as PROFILE from '../../../../modules/profiler';
import * as BGL from './buildgl';
import * as BUFF from './buffers';
import * as BU from '../boardutils';
import * as MU from '../../../../libs/mathutils';
import * as VEC from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';

class WallSectorId {
  constructor(public wallId:number, public sectorId:number) {}
}

interface BoardVisitorResult {
  forSector(board:Board, secv:SectorVisitor);
  forWall(board:Board, wallv:WallVisitor);
  forSprite(board:Board, sprv:SpriteVisitor);
}

type BoardVisitor = (board:Board, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) => void;
type SectorVisitor = (board:Board, sectorId:number) => void;
type WallVisitor = (board:Board, wallId:number, sectorId:number) => void;
type SpriteVisitor = (board:Board, spriteId:number) => void;

class AllBoardVisitorResult implements BoardVisitorResult {
  
  constructor(private board:Board) {}

  public forSector(board:Board, secv:SectorVisitor) {
    for (var s = 0; s < this.board.sectors.length; s++)
      secv(this.board, s);
  }
  
  public forWall(board:Board, wallv:WallVisitor) {
    for (var s = 0; s < this.board.sectors.length; s++) {
      var sec = this.board.sectors[s];
      var endwall = sec.wallptr+sec.wallnum;
      for (var w = sec.wallptr; w < endwall; w++)
        wallv(this.board, w, s);
    }
  }

  public forSprite(board:Board, sprv:SpriteVisitor) {
    for (var s = 0; s < this.board.sprites.length; s++)
      sprv(this.board, s);
  }
}

class PvsBoardVisitorResult implements BoardVisitorResult {
  private sectors:number[] = [];
  private walls:WallSectorId[] = [];
  private sprites:number[] = [];

  constructor(private board:Board, private ms:U.MoveStruct) {
    var pvs = [this.ms.sec];
    var sectors = this.board.sectors;
    var walls = this.board.walls;
    var sec2spr = U.groupSprites(this.board.sprites);
    for (var i = 0; i < pvs.length; i++) {
      var s = pvs[i];
      var sec = sectors[s];
      if (sec == undefined)
        continue;

      this.sectors.push(s);
      var endwall = sec.wallptr + sec.wallnum;
      for (var w = sec.wallptr; w < endwall; w++) {
        var wall = walls[w];
        if (U.wallVisible(wall, walls[wall.point2], this.ms)) {
          this.walls.push(new WallSectorId(w ,s));
          var nextsector = wall.nextsector;
          if (nextsector == -1) continue;
          if (pvs.indexOf(nextsector) == -1)
            pvs.push(nextsector);
        }
      }

      var sprs = sec2spr[s];
      if (sprs != undefined) {
        Array.prototype.push.apply(this.sprites, sprs);
      }
    }
  }

  public forSector(board:Board, secv:SectorVisitor) {
    for (var i = 0; i < this.sectors.length; i++)
      secv(this.board, this.sectors[i]);
  }

  public forWall(board:Board, wallv:WallVisitor) {
    for (var i = 0; i < this.walls.length; i++) {
      var id = this.walls[i];
      wallv(this.board, id.wallId, id.sectorId);
    }
  }

  public forSprite(board:Board, sprv:SpriteVisitor) {
    for (var i = 0; i < this.sprites.length; i++)
      sprv(this.board, this.sprites[i]);
  }
}

function all(board:Board):BoardVisitorResult {
  return new AllBoardVisitorResult(board);
}

function visible(board:Board, ms:U.MoveStruct) {
  return new PvsBoardVisitorResult(board, ms);
}

export interface PalProvider extends ArtProvider {
  getPalTexture():DS.Texture;
  getPluTexture():DS.Texture;
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
  BGL.init(gl, art.getPalTexture(), art.getPluTexture(), cb);
}


var selectType = -1;
var selectId = -1;

var hit = new U.Hitscan();
function hitscan(board:Board, ms:U.MoveStruct, ctr:C.Controller3D) {
  var [vx, vz, vy] = ctr.getForwardMouse();
  U.hitscan(board, artProvider, ms.x, ms.y, ms.z, ms.sec, vx, vy, -vz, hit, 0);
  if (ctr.isClick()) {
    if (hit.t == -1) {
      selectType = -1;
      selectId = -1;
    } else {
      selectType = hit.type;
      selectId = hit.id;
    }
  }
}

export function draw(gl:WebGLRenderingContext, board:Board, ms:U.MoveStruct, ctr:C.Controller3D) {
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clearStencil(0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
  drawImpl(gl, board, ms, ctr);

  hitscan(board, ms, ctr);
  if (hit.t != -1) {
    BGL.setCursorPosiotion([hit.x, hit.z/-16, hit.y]);
  }

  highlightSelected(gl, board);

  if (U.isWall(selectType) && ctr.getKeys()['Q']) {
    selectId = BU.pushWall(board, selectId, -128, artProvider, []);
    cache.invalidateAll();
  }
  if (U.isWall(selectType) && ctr.getKeys()['E']) {
    selectId = BU.pushWall(board, selectId, 128, artProvider, []);
    cache.invalidateAll();
  }
  if (U.isWall(selectType) && ctr.getKeys()['M']) {
    board.walls[selectId].picnum = 504;
  }
}

function highlightSelected(gl:WebGLRenderingContext, board:Board) {
  gl.disable(gl.DEPTH_TEST);
  if (U.isSector(selectType)) {
    var sector = cache.getSectorWireframe(selectId);
    switch (selectType) {
      case U.HitType.CEILING:
        BGL.draw(gl, sector.ceiling);
        break;
      case U.HitType.FLOOR:
        BGL.draw(gl, sector.floor);
        break;
    }
  } 
  if (U.isWall(selectType)) {
    var wall = cache.getWallWireframe(selectId, BU.findSector(board, selectId));
    switch (selectType) {
      case U.HitType.UPPER_WALL:
        BGL.draw(gl, wall.top);
        break;
      case U.HitType.MID_WALL:
        BGL.draw(gl, wall.mid);
        break;
      case U.HitType.LOWER_WALL:
        BGL.draw(gl, wall.bot);
        break;
    }
  }
  if (U.isSprite(selectType)) {
    var sprite = cache.getSpriteWireframe(selectId);
    BGL.draw(gl, sprite);
  }
  gl.enable(gl.DEPTH_TEST);
}

function drawImpl(gl:WebGLRenderingContext, board:Board, ms:U.MoveStruct, ctr:C.Controller3D) {
  if (!U.inSector(board, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board, ms.x, ms.y, ms.sec);
  }

  PROFILE.startProfile('processing');
  var result = ms.sec == -1 
    ? all(board) 
    : visible(board, ms);

  drawMirrors(gl, board, result, ms, ctr);

  BGL.setViewMatrices(ctr.getProjectionMatrix(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPos());
  drawRooms(gl, board, result);
}

function drawMirrors(gl:WebGLRenderingContext, board:Board, result:BoardVisitorResult, ms:U.MoveStruct, ctr:C.Controller3D) {
  var mirrorWalls = [];
  result.forWall(board, (board:Board, wallId:number, sectorId:number) => {
    if (board.walls[wallId].picnum == 504) {
      mirrorWalls.push(wallId);
    }
  });
  if (mirrorWalls.length == 0)
    return;

  gl.enable(gl.STENCIL_TEST);
  var msMirrored = new U.MoveStruct();
  for (var i = 0; i < mirrorWalls.length; i++) {
    var w = mirrorWalls[i];
    var w1 = board.walls[w];
    var w2 = board.walls[w1.point2];
    if (!U.wallVisible(w1, w2, ms))
      continue;
    var mirrorNormal = GLM.vec3.fromValues(w2.y-w1.y, 0, -w2.x+w1.x);
    GLM.vec3.normalize(mirrorNormal, mirrorNormal);
    var mirrorrD = -mirrorNormal[0]*w1.x - mirrorNormal[2]*w1.y;
    var mirroredTransform = ctr.getCamera().getMirroredTransformMatrix(mirrorNormal, mirrorrD);
    if (mirroredTransform == null)
      continue;

    gl.stencilFunc(gl.ALWAYS, 1+i, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    gl.stencilMask(0xff);
    gl.depthMask(false);
    gl.colorMask(false, false, false, false);

    var r = cache.getWall(w, BU.findSector(board, w));
    BGL.setViewMatrices(ctr.getProjectionMatrix(), ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPos());
    BGL.draw(gl, r.top);
    BGL.draw(gl, r.bot);
    BGL.draw(gl, r.mid);

    gl.stencilFunc(gl.EQUAL, 1+i, 0xff);
    gl.stencilMask(0x0);
    gl.depthMask(true);
    gl.colorMask(true, true, true, true);

    BGL.setViewMatrices(ctr.getProjectionMatrix(), mirroredTransform, ctr.getCamera().getPos());
    BGL.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
    gl.cullFace(gl.FRONT);
    var mpos = VEC.reflectPoint3d([0, 0, 0], mirrorNormal, mirrorrD, [ms.x, ms.z, ms.y]);
    msMirrored.sec = ms.sec; msMirrored.x = mpos[0]; msMirrored.y = mpos[2]; msMirrored.z = mpos[1];
    drawRooms(gl, board, visible(board, msMirrored));
    gl.cullFace(gl.BACK);

    gl.colorMask(false, false, false, false);
    BGL.draw(gl, r.top);
    BGL.draw(gl, r.bot);
    BGL.draw(gl, r.mid);
  }
  gl.disable(gl.STENCIL_TEST);
  gl.colorMask(true, true, true, true);
  BGL.setClipPlane(0, 0, 0, 0);
}

function drawRooms(gl:WebGLRenderingContext, board:Board, result:BoardVisitorResult) {
  var surfaces:Renderable[] = [];
  var surfacesTrans:Renderable[] = [];
  var sprites:Renderable[] = [];
  var spritesTrans:Renderable[] = [];

  result.forSector(board, (board:Board, sectorId:number) => {
    var sector = cache.getSector(sectorId);
    surfaces.push(sector.ceiling, sector.floor);
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
      surfaces.push(wall.bot, wall.mid, wall.top);
    }
    PROFILE.incCount('walls');
  });
  result.forSprite(board, (board:Board, spriteId:number) => {
    var sprite = cache.getSprite(spriteId);
    var trans = sprite.trans != 1;
    (sprite.type == Type.FACE 
      ? (trans ? spritesTrans : sprites) 
      : (trans ? surfacesTrans : surfaces))
    .push(sprite);
    PROFILE.incCount('sprites');
  });
  PROFILE.set('buffer', BUFF.getFreeSpace());
  PROFILE.endProfile();

  PROFILE.startProfile('draw');
  for (var i = 0; i < surfaces.length; i++) {
    BGL.draw(gl, surfaces[i]);
  }

  for (var i = 0; i < sprites.length; i++) {
    gl.polygonOffset(-1, -8);
    BGL.draw(gl, sprites[i]);
  }
  gl.polygonOffset(0, 0);

  for (var i = 0; i < surfacesTrans.length; i++) {
    BGL.draw(gl, surfacesTrans[i]);
  }
  
  for (var i = 0; i < spritesTrans.length; i++) {
    gl.polygonOffset(-1, -8);
    BGL.draw(gl, spritesTrans[i]);
  }
  gl.polygonOffset(0, 0);
  PROFILE.endProfile();
}