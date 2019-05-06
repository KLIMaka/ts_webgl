import {Board, Sector, Wall, Sprite} from '../structs';
import {Renderable} from './renderable';
import {Cache, ArtProvider} from './cache';
import * as DS from '../../../drawstruct';
import * as U from '../utils';
import * as C from '../../../../modules/controller3d';
import * as PROFILE from '../../../../modules/profiler';
import * as BGL from './buildgl';
import * as BU from '../boardutils';
import * as MU from '../../../../libs/mathutils';

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
  private surfaces:Renderable[];
  private sprites:Renderable[];
  private secv:SectorVisitor;
  private wallv:WallVisitor;
  private sprv:SpriteVisitor;
  public cache:Cache;

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

var artProvider:PalProvider;
var queue:DrawQueue;
export function init(gl:WebGLRenderingContext, art:PalProvider, board:Board) {
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  artProvider = art;
  BGL.init(gl, art.getPalTexture(), art.getPluTexture());
  queue = new DrawQueue(board, art);
}

var hit = new U.Hitscan();
function hitscan(board:Board, ms:U.MoveStruct, ctr:C.Controller3D) {
  var [vx, vz, vy] = ctr.getForwardMouse();
  U.hitscan(board, artProvider, ms.x, ms.y, ms.z, ms.sec, vx, vy, -vz, hit, 0);
}

export function draw(gl:WebGLRenderingContext, board:Board, ms:U.MoveStruct, ctr:C.Controller3D) {
  BGL.setController(ctr);
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  drawImpl(gl, board, ms);

  hitscan(board, ms, ctr);
  if (hit.t != -1) {
    BGL.setCursorPosiotion([hit.x, hit.z/-16, hit.y]);
  }

  gl.disable(gl.DEPTH_TEST);
  if (hit.sect != -1) {
    var sector = queue.cache.getSector(hit.sect);
    switch (hit.type) {
      case U.HitType.CEILING:
        BGL.draw(gl, sector.ceiling, gl.LINES);
        break;
      case U.HitType.FLOOR:
        BGL.draw(gl, sector.floor, gl.LINES);
        break;
    }
  } 
  if (hit.wall != -1) {
    var wall = queue.cache.getWall(hit.wall, 0);
    switch (hit.type) {
      case U.HitType.UPPER_WALL:
        BGL.draw(gl, wall.top, gl.LINES);
        break;
      case U.HitType.MID_WALL:
        BGL.draw(gl, wall.mid, gl.LINES);
        break;
      case U.HitType.LOWER_WALL:
        BGL.draw(gl, wall.bot, gl.LINES);
        break;
    }
  }
  if (hit.sprite != -1) {
    var sprite = queue.cache.getSprite(hit.sprite);
    BGL.draw(gl, sprite, gl.LINES);
  }
  gl.enable(gl.DEPTH_TEST);

  if (hit.t != -1) {
    if (hit.wall != -1 && ctr.getKeys()['F']) {
      BU.splitWall(board, hit.wall, hit.x, hit.y, artProvider);
      queue.cache.invalidateAll();
    }

    if (hit.wall != -1 && ctr.getKeys()['E'] && ctr.isClick()) {
      var w1 = hit.wall;
      var wall1 = board.walls[w1];
      var w2 = wall1.point2;
      var wall2 = board.walls[w2];
      var dx = wall2.x - wall1.x;
      var dy = wall2.y - wall1.y;
      var l = Math.sqrt(dx*dx + dy*dy);
      dx = MU.int(dx/l * 128);
      dy = MU.int(dy/l * 128);
      var x1 = wall1.x-dy; var y1 = wall1.y+dx;
      var x2 = wall2.x-dy; var y2 = wall2.y+dx;


      BU.splitWall(board, w1, x2, y2, artProvider);
      BU.splitWall(board, w1, x1, y1, artProvider);
      // BU.moveWall(board, w1, wall1.x-dy, wall1.y+dx);
      // BU.moveWall(board, w2, wall2.x-dy, wall2.y+dx);
      queue.cache.invalidateAll();
    }

    if (ctr.isClick()) {
      if (hit.sect != -1) {
        console.log(hit.sect, board.sectors[hit.sect]);
      } 
      if (hit.wall != -1) {
        console.log(hit.wall, board.walls[hit.wall]);
      }
      if (hit.sprite != -1) {
        console.log(hit.sprite, board.sprites[hit.sprite]);
      }
    }
  }
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