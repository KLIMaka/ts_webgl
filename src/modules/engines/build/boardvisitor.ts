import { arcsIntersects, monoatan2 } from '../../../libs/mathutils';
import * as GLM from '../../../libs_js/glmatrix';
import { IndexedDeck, Deck } from '../../deck';
import { nextwall } from './boardutils';
import { Board } from './structs';
import * as U from './utils';

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
  public sectors = new Deck<number>();

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
  public walls = new Deck<number>();

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
  public sprites = new Deck<number>();

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
  return false;
  // let wall1 = board.walls[wallId];
  // let wall2 = board.walls[wall1.point2];
  // let dx1 = wall1.x - ms.x; let dy1 = wall1.y - ms.y;
  // let dx2 = wall2.x - ms.x; let dy2 = wall2.y - ms.y;
  // return dot2d(dx1, dy1, fwd[0], fwd[2]) < 0 && dot2d(dx2, dy2, fwd[0], fwd[2]) < 0;
}

let dummyEntryWalls = new Deck<number>();
export class PvsBoardVisitorResult implements Result {
  private sectors = new Deck<number>();
  private walls = new Deck<number>();
  private sprites = new Deck<number>();
  private prepvs = new IndexedDeck<number>();
  private pvs = new IndexedDeck<number>();
  private entryWalls = new Deck<Deck<number>>();
  private board: Board;
  private angCache = new Map<number, number>();
  private cachedX = 0;
  private cachedY = 0;
  private needToUpdate = true;

  private init(board: Board, sectorId: number) {
    this.board = board;
    this.sectors.clear();
    this.walls.clear();
    this.sprites.clear();
    this.prepvs.clear();
    this.prepvs.push(sectorId);
    this.pvs.clear();
    this.pvs.push(sectorId);
    if (this.entryWalls.length() == 0)
      this.entryWalls.push(dummyEntryWalls);
    this.angCache.clear();
  }

  private fillPVS(ms: U.MoveStruct, forward: GLM.Vec3Array) {
    for (let i = 0; i < this.prepvs.length(); i++) {
      let s = this.prepvs.get(i);
      let sec = this.board.sectors[s];
      if (sec == undefined) continue;
      let endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!U.wallVisible(this.board, w, ms) || wallBehind(this.board, w, forward, ms)) continue;

        let wall = this.board.walls[w];
        let nextsector = wall.nextsector;
        if (nextsector == -1) continue;
        let nextwall = wall.nextwall;
        let pvsIdx = this.prepvs.indexOf(nextsector);
        if (pvsIdx == -1) {
          this.prepvs.push(nextsector);
          pvsIdx = this.prepvs.length() - 1;
          let ewalls = this.entryWalls.get(pvsIdx);
          if (ewalls == undefined) {
            ewalls = new Deck<number>();
            this.entryWalls.push(ewalls);
          }
          ewalls.clear();
          ewalls.push(nextwall);
        } else {
          let ewalls = this.entryWalls.get(pvsIdx);
          ewalls.push(nextwall);
        }
      }
    }
  }

  private getAngForWall(wallId: number, ms: U.MoveStruct) {
    let ang = this.angCache.get(wallId);
    if (ang == undefined) {
      let wall = this.board.walls[wallId];
      let dx = wall.x - ms.x;
      let dy = wall.y - ms.y;
      ang = monoatan2(dy, dx);
      this.angCache.set(wallId, ang);
    }
    return ang;
  }

  private visibleFromEntryWalls(wallId: number, entryWalls: Deck<number>, ms: U.MoveStruct) {
    if (entryWalls.length() == 0)
      return true;
    for (let i = 0; i < entryWalls.length(); i++) {
      let ew = entryWalls.get(i);
      let a1s = this.getAngForWall(nextwall(this.board, ew), ms);
      let a1e = this.getAngForWall(ew, ms);
      let a2s = this.getAngForWall(wallId, ms);
      let a2e = this.getAngForWall(nextwall(this.board, wallId), ms);
      if (arcsIntersects(a1s, a1e, a2s, a2e))
        return true;
    }
    return false;
  }

  private cached(board: Board, ms:U.MoveStruct) {
    if (!this.needToUpdate && ms.x == this.cachedX && ms.y == this.cachedY)
      return true;
    this.init(board, ms.sec);
    this.cachedX = ms.x;
    this.cachedY = ms.y;
    this.needToUpdate = false;
    return false;
  }

  public reset() {
    this.needToUpdate = true;
  }

  public visit(board: Board, ms: U.MoveStruct, forward: GLM.Vec3Array): Result {
    if (this.cached(board, ms))
      return this;

    this.fillPVS(ms, forward);
    let sectors = board.sectors;
    let sec2spr = U.groupSprites(board.sprites);
    for (let i = 0; i < this.pvs.length(); i++) {
      let s = this.pvs.get(i);
      let entryWallsIdx = this.prepvs.indexOf(s);
      let entryWalls = this.entryWalls.get(entryWallsIdx);
      let sec = sectors[s];
      if (sec == undefined) continue;

      this.sectors.push(s);
      let endwall = sec.wallptr + sec.wallnum;
      for (let w = sec.wallptr; w < endwall; w++) {
        if (!U.wallVisible(board, w, ms) || wallBehind(board, w, forward, ms) || !this.visibleFromEntryWalls(w, entryWalls, ms))
          continue;

        this.walls.push(packWallSectorId(w, s));

        let wall = board.walls[w];
        let nextsector = wall.nextsector;
        if (nextsector == -1) continue;
        if (this.pvs.indexOf(nextsector) == -1) {
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