import { Board } from './structs';
import * as U from './utils';
import { NumberVector, ObjectVector } from '../../vector';
import * as GLM from '../../../libs_js/glmatrix';
import { dot2d, cross2d } from '../../../libs/mathutils';
import { init } from './gl/boardrenderer';

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

function wallBehind(board: Board, wallId: number, fwd: GLM.Vec3Array, ms: U.MoveStruct) {
  let wall1 = board.walls[wallId];
  let wall2 = board.walls[wall1.point2];
  let dx1 = wall1.x - ms.x; let dy1 = wall1.y - ms.y;
  let dx2 = wall2.x - ms.x; let dy2 = wall2.y - ms.y;
  return dot2d(dx1, dy1, fwd[0], fwd[2]) < 0 && dot2d(dx2, dy2, fwd[0], fwd[2]) < 0;
}

function visibleFromEntryWalls(board: Board, wallId: number, entryWalls: NumberVector, ms:U.MoveStruct) {
  if (entryWalls.length() == 0)
    return true;
  for (let i = 0; i < entryWalls.length(); i++) {
    let ew = entryWalls.get(i);
    let wall1 = board.walls[wallId]; let wall2 = board.walls[wall1.point2];
    let ewall1 = board.walls[ew]; let ewall2 = board.walls[ewall1.point2];
    let v1x = ewall1.x - ms.x; let v1y = ewall1.x - ms.y;
    let v2x = ewall2.x - ms.x; let v2y = ewall2.x - ms.y;
  }
  return false;
}

let dummyEntryWalls = new NumberVector();
export class PvsBoardVisitorResult implements Result {
  private sectors = new NumberVector();
  private walls = new NumberVector();
  private sprites = new NumberVector();
  private pvs = new NumberVector();
  private entryWalls = new ObjectVector<NumberVector>();
  private board: Board;

  private init(board: Board, sectorId: number) {
    this.board = board;
    this.sectors.clear();
    this.walls.clear();
    this.sprites.clear();
    this.pvs.clear();
    this.pvs.push(sectorId);
    if (this.entryWalls.length() == 0)
      this.entryWalls.push(dummyEntryWalls);
  }

  public visit(board: Board, ms: U.MoveStruct, forward: GLM.Vec3Array): Result {
    this.init(board, ms.sec);
    let sectors = board.sectors;
    let walls = board.walls;
    let sec2spr = U.groupSprites(board.sprites);
    for (let i = 0; i < this.pvs.length(); i++) {
      let s = this.pvs.get(i);
      let entryWalls = this.entryWalls.get(i);
      let sec = sectors[s];
      if (sec == undefined)
        continue;

      this.sectors.push(s);
      let endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++) {
        if (U.wallVisible(board, w, ms)
          && !wallBehind(board, w, forward, ms)
          && visibleFromEntryWalls(board, w, entryWalls, ms)) {

          this.walls.push(packWallSectorId(w, s));
          let wall = walls[w];
          let nextsector = wall.nextsector;
          if (nextsector == -1) continue;
          let nextwall = wall.nextwall;
          let pvsIdx = this.pvs.indexOf(nextsector);
          if (pvsIdx == -1) {
            this.pvs.push(nextsector);
            pvsIdx = this.pvs.length() - 1;
            let ewalls = this.entryWalls.get(pvsIdx);
            if (ewalls == undefined) {
              ewalls = new NumberVector();
              this.entryWalls.push(ewalls);
            }
            ewalls.clear();
            ewalls.push(nextwall);
          } else if (pvsIdx > i) {
            let ewalls = this.entryWalls.get(pvsIdx);
            ewalls.push(nextwall);
          }
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