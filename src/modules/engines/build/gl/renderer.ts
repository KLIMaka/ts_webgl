import {Board, Sector, Wall, Sprite} from '../structs';
import {Drawable} from './drawable';
import {Cache, ArtProvider} from './cache';
import * as DS from '../../../drawstruct';
import * as U from '../utils';
import * as C from '../../../../modules/controller3d';
import * as PROFILE from '../../../../modules/profiler';
import * as BGL from './buildgl';

type BoardVisitor = (board:Board, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) => void;
type SectorVisitor = (board:Board, sectorId:number) => void;
type WallVisitor = (board:Board, wallId:number, sectorId:number) => void;
type SpriteVisitor = (board:Board, spriteId:number) => void;


function visitAll(board:Board, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) {
  for (var s = 0; s < board.sectors.length; s++) {
    var sec = board.sectors[s];
    secv(board, s);
    var endwall = sec.wallnum+sec.wallptr;
    for (var w = sec.wallptr; w < endwall; w++) {
      wallv(board, w, s);
    }
  }
  for (var s = 0; s < board.sprites.length; s++) {
    sprv(board, s);
  }
}

function visitVisible(board:Board, ms:U.MoveStruct, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) {
  var pvs = [ms.sec];
  var sectors = board.sectors;
  var walls = board.walls;
  var sprites = board.sprites;
  var sec2spr = U.groupSprites(sprites);
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
  private surfaces:Drawable[];
  private sprites:Drawable[];
  private secv:SectorVisitor;
  private wallv:WallVisitor;
  private sprv:SpriteVisitor;
  private cache:Cache;

  constructor(private board:Board, art:ArtProvider) {
    this.cache = new Cache(board, art);
    this.secv = (board:Board, sectorId:number) => {
      var sector = this.cache.getSector(sectorId);
      this.surfaces.push(sector.ceiling, sector.floor);
      PROFILE.incCount('sectors');
    }
    this.wallv = (board:Board, wallId:number, sectorId:number) => {
      var wall = this.cache.getWall(wallId, sectorId);
      this.surfaces.push(wall.bot, wall.mid, wall.top);
      PROFILE.incCount('walls');
    }
    this.sprv = (board:Board, spriteId:number) => {
      var sprite = this.cache.getSprite(spriteId);
      this.sprites.push(sprite);
      PROFILE.incCount('sprites');
    } 
  }

  public draw(gl:WebGLRenderingContext, boardVisitor:BoardVisitor) {
    this.surfaces = [];
    this.sprites = [];

    PROFILE.startProfile('processing');
    boardVisitor(this.board, this.secv, this.wallv, this.sprv);
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

export interface PalProvider extends ArtProvider {
  getPalTexture():DS.Texture;
  getPluTexture():DS.Texture;
}

export function init(gl:WebGLRenderingContext, art:PalProvider, board:Board) {
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  BGL.init(gl, art.getPalTexture(), art.getPluTexture());
  queue = new DrawQueue(board, art);
}

var queue:DrawQueue;


export function draw(gl:WebGLRenderingContext, board:Board, ms:U.MoveStruct, ctr:C.Controller3D) {
  BGL.setController(ctr);
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawImpl(gl, board, ms);
}

function drawImpl(gl:WebGLRenderingContext, board:Board, ms:U.MoveStruct) {
  if (!U.inSector(board, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board, ms.x, ms.y, ms.sec);
  }
  if (ms.sec == -1) {
    queue.draw(gl, visitAll);
  } else {
    queue.draw(gl, (board:Board, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) => visitVisible(board, ms, secv, wallv, sprv));
  }
}