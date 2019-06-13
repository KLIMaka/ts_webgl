import {Board, Sector, Wall, Sprite} from './structs';
import * as U from './utils';

class WallSectorId {
  constructor(public wallId:number, public sectorId:number) {}
}

export interface Result {
  forSector(board:Board, secv:SectorVisitor);
  forWall(board:Board, wallv:WallVisitor);
  forSprite(board:Board, sprv:SpriteVisitor);
}

export type BoardVisitor = (board:Board, secv:SectorVisitor, wallv:WallVisitor, sprv:SpriteVisitor) => void;
export type SectorVisitor = (board:Board, sectorId:number) => void;
export type SectorPredicate = (board:Board, sectorId:number) => boolean;
export type WallVisitor = (board:Board, wallId:number, sectorId:number) => void;
export type WallPredicate = (board:Board, wallId:number, sectorId:number) => boolean;
export type SpriteVisitor = (board:Board, spriteId:number) => void;
export type SpritePredicate = (board:Board, spriteId:number) => boolean;

export class SectorCollector {
  private visitor:SectorVisitor;
  public sectors:number[];

  constructor(private pred:SectorPredicate) {
    this.visitor = (board:Board, sectorId:number) => {
      if (this.pred(board, sectorId))
        this.sectors.push(sectorId);
    }
  }

  public visit():SectorVisitor {
    this.sectors = [];
    return this.visitor;
  }
}

export function createSectorCollector(pred:SectorPredicate) {
  return new SectorCollector(pred);
}

export class WallCollector {
  private visitor:WallVisitor;
  public walls:WallSectorId[];

  constructor(private pred:WallPredicate) {
    this.visitor = (board:Board, wallId:number, sectorId:number) => {
      if (this.pred(board, wallId, sectorId))
        this.walls.push(new WallSectorId(wallId, sectorId));
    }
  }

  public visit():WallVisitor {
    this.walls = [];
    return this.visitor;
  }
}

export function createWallCollector(pred:WallPredicate) {
  return new WallCollector(pred);
}

export class SpriteCollector {
  private visitor:SpriteVisitor;
  public sprites:number[];

  constructor(private pred:SpritePredicate) {
    this.visitor = (board:Board, spriteId:number) => {
      if (this.pred(board, spriteId))
        this.sprites.push(spriteId);
    }
  }

  public visit():SectorVisitor {
    this.sprites = [];
    return this.visitor;
  }
}

export function createSpriteCollector(pred:SpritePredicate) {
  return new SpriteCollector(pred);
}


class AllBoardVisitorResult implements Result {
  
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

class PvsBoardVisitorResult implements Result {
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
          this.walls.push(new WallSectorId(w, s));
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

export function all(board:Board):Result {
  return new AllBoardVisitorResult(board);
}

export function visible(board:Board, ms:U.MoveStruct):Result {
  return new PvsBoardVisitorResult(board, ms);
}