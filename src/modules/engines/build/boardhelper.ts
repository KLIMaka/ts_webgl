import { Board, Sprite } from "./structs";
import { List, Node } from "../../../libs/list";
import { prevwall, nextwall } from "./boardutils";

export type Pointer = Node<number>;

export class BoardHelper {
  private spritesBySector: Map<number, List<number>> = new Map();
  private prevWallCache: Map<number, number> = new Map();

  private spritePointers: List<number> = new List();

  constructor(
    readonly board: Board
  ) {
    this.fillSpritesBySector();
  }

  private ensureSpritesList(sectorId: number): List<number> {
    let sprites = this.spritesBySector.get(sectorId);
    if (sprites == undefined) {
      sprites = new List();
      this.spritesBySector.set(sectorId, sprites);
    }
    return sprites;
  }

  private fillSpritesBySector() {
    for (let s = 0; s < this.board.numsprites; s++) {
      let spr = this.board.sprites[s];
      this.ensureSpritesList(spr.sectnum).push(s);
    }
  }

  public insertSprite(spr: Sprite) {
    let idx = this.board.numsprites++;
    this.board.sprites[idx] = spr;
    this.ensureSpritesList(spr.sectnum).push(idx);
  }

  public deleteSprite(spriteId: number) {
    for (let s = spriteId; s < this.board.numsprites; s++) {
      this.board.sprites[s] = this.board.sprites[s + 1];
    }
    for (let n = this.spritePointers.first(); n != this.spritePointers.terminator(); n = n.next) {
      if (n.obj == spriteId) n.obj = -1;
      if (n.obj > spriteId) n.obj--;
    }
    this.board.numsprites--;
    for (let [, l] of this.spritesBySector) {
      for (let node = l.first(); node != l.terminator(); node = node.next) {
        if (node.obj == spriteId) l.remove(node);
        if (node.obj > spriteId) node.obj--;
      }
    }
  }

  public updateSpriteSector(spriteId: number, newSectorId: number): boolean {
    let spr = this.board.sprites[spriteId];
    if (newSectorId == spr.sectnum) return false;
    let sectorSprites = this.spritesBySector.get(spr.sectnum);
    for (let s = sectorSprites.first(); s != sectorSprites.terminator(); s = s.next) {
      if (s.obj == spriteId) {
        sectorSprites.remove(s);
        break;
      }
    }
    this.ensureSpritesList(newSectorId).push(spriteId);
    return true;
  }

  public spritePtr(spriteId: number): Pointer {
    return this.spritePointers.push(spriteId);
  }

  public prevwall(wallId: number): number {
    let prev = this.prevWallCache.get(wallId);
    if (prev == undefined) {
      prev = prevwall(this.board, wallId);
      this.prevWallCache.set(wallId, prev);
    }
    return prev;
  }

  public nextwall(wallId: number): number {
    return nextwall(this.board, wallId);
  }


}