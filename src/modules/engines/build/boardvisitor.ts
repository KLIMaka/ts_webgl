import { Board } from './structs';
import * as U from './utils';
import { NumberVector } from '../../vector';

export function packWallSectorId(wallId: number, sectorId: number) {
  return wallId | (sectorId << 16)
}

export function unpackWallId(wallSectorId: number) {
  return wallSectorId & 0xffff;
}

export function unpackSectorId(wallSectorId: number) {
  return (wallSectorId >> 16) & 0xffff;
}

export interface Result {
  forSector(secv: SectorVisitor): void;
  forWall(wallv: WallVisitor): void;
  forSprite(sprv: SpriteVisitor): void;
}

export type BoardVisitor = (board: Board, secv: SectorVisitor, wallv: WallVisitor, sprv: SpriteVisitor) => void;
export type SectorVisitor = (board: Board, sectorId: number) => void;
export type SectorPredicate = (board: Board, sectorId: number) => boolean;
export type WallVisitor = (board: Board, wallId: number, sectorId: number) => void;
export type WallPredicate = (board: Board, wallId: number, sectorId: number) => boolean;
export type SpriteVisitor = (board: Board, spriteId: number) => void;
export type SpritePredicate = (board: Board, spriteId: number) => boolean;

export class SectorCollector {
  private visitor: SectorVisitor;
  public sectors = new NumberVector();

  constructor(pred: SectorPredicate) {
    this.visitor = (board: Board, sectorId: number) => {
      if (pred(board, sectorId))
        this.sectors.push(sectorId);
    }
  }

  public visit(): SectorVisitor {
    this.sectors.clear();
    return this.visitor;
  }
}

export function createSectorCollector(pred: SectorPredicate) {
  return new SectorCollector(pred);
}

export class WallCollector {
  private visitor: WallVisitor;
  public walls = new NumberVector();

  constructor(pred: WallPredicate) {
    this.visitor = (board: Board, wallId: number, sectorId: number) => {
      if (pred(board, wallId, sectorId))
        this.walls.push(packWallSectorId(wallId, sectorId));
    }
  }

  public visit(): WallVisitor {
    this.walls.clear();
    return this.visitor;
  }
}

export function createWallCollector(pred: WallPredicate) {
  return new WallCollector(pred);
}

export class SpriteCollector {
  private visitor: SpriteVisitor;
  public sprites = new NumberVector();

  constructor(pred: SpritePredicate) {
    this.visitor = (board: Board, spriteId: number) => {
      if (pred(board, spriteId))
        this.sprites.push(spriteId);
    }
  }

  public visit(): SectorVisitor {
    this.sprites.clear();
    return this.visitor;
  }
}

export function createSpriteCollector(pred: SpritePredicate) {
  return new SpriteCollector(pred);
}


export class AllBoardVisitorResult implements Result {
  private board: Board;

  visit(board: Board): Result {
    this.board = board;
    return this;
  }

  public forSector(secv: SectorVisitor) {
    for (let s = 0; s < this.board.sectors.length; s++)
      secv(this.board, s);
  }

  public forWall(wallv: WallVisitor) {
    for (let s = 0; s < this.board.sectors.length; s++) {
      let sec = this.board.sectors[s];
      let endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++)
        wallv(this.board, w, s);
    }
  }

  public forSprite(sprv: SpriteVisitor) {
    for (let s = 0; s < this.board.sprites.length; s++)
      sprv(this.board, s);
  }
}

export class PvsBoardVisitorResult implements Result {
  private sectors = new NumberVector();
  private walls = new NumberVector();
  private sprites = new NumberVector();
  private pvs = new NumberVector();
  private board: Board;

  public visit(board: Board, ms: U.MoveStruct): Result {
    this.board = board;
    this.sectors.clear();
    this.walls.clear();
    this.sprites.clear();
    this.pvs.clear();
    this.pvs.push(ms.sec);

    let sectors = board.sectors;
    let walls = board.walls;
    let sec2spr = U.groupSprites(board.sprites);
    for (let i = 0; i < this.pvs.length(); i++) {
      let s = this.pvs.get(i);
      let sec = sectors[s];
      if (sec == undefined)
        continue;

      this.sectors.push(s);
      let endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++) {
        let wall = walls[w];
        if (U.wallVisible(wall, walls[wall.point2], ms)) {
          this.walls.push(packWallSectorId(w, s));
          let nextsector = wall.nextsector;
          if (nextsector == -1) continue;
          if (this.pvs.indexOf(nextsector) == -1)
            this.pvs.push(nextsector);
        }
      }

      let sprs = sec2spr[s];
      if (sprs != undefined) {
        for (let i = 0; i < sprs.length; i++)
          this.sprites.push(sprs[i]);
      }
    }
    return this;
  }

  public forSector(secv: SectorVisitor) {
    for (let i = 0; i < this.sectors.length(); i++)
      secv(this.board, this.sectors.get(i));
  }

  public forWall(wallv: WallVisitor) {
    for (let i = 0; i < this.walls.length(); i++) {
      let id = this.walls.get(i);
      wallv(this.board, unpackWallId(id), unpackSectorId(id));
    }
  }

  public forSprite(sprv: SpriteVisitor) {
    for (let i = 0; i < this.sprites.length(); i++)
      sprv(this.board, this.sprites.get(i));
  }
}