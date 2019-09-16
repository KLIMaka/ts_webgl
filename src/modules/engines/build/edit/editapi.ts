import { ArtProvider } from "../gl/cache";
import { Board } from "../structs";
import { MovingHandle } from "./handle";
import { Message, Context } from "../messages";
import { SubType } from "../hitscan";

export interface BuildContext extends Context {
  art: ArtProvider;
  gl: WebGLRenderingContext;
  board: Board;

  snap(x: number): number;
  snapScale(): number;
  scaledSnap(x: number, scale: number): number;

  invalidateAll(): void;
  invalidateSector(id: number): void;
  invalidateWall(id: number): void;
  invalidateSprite(id: number): void;

  highlightSector(gl: WebGLRenderingContext, board: Board, sectorId: number): void;
  highlightWallSegment(gl: WebGLRenderingContext, board: Board, wallId: number, sectorId: number): void;
  highlightWall(gl: WebGLRenderingContext, board: Board, wallId: number): void;
  highlightSprite(gl: WebGLRenderingContext, board: Board, spriteId: number): void;
  highlight(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: SubType): void;
}

export class StartMove implements Message { constructor(public handle: MovingHandle) { } }
export class Move implements Message { constructor(public handle: MovingHandle) { } }
export class EndMove implements Message { constructor(public handle: MovingHandle) { } }
export class Highlight implements Message { }
export class SetPicnum implements Message { constructor(public picnum: number) { } }
export class ToggleParallax implements Message { }
export class Shade implements Message { constructor(public value: number, public absolute = false) { } }
export class PanRepeat implements Message { constructor(public xpan: number, public ypan: number, public xrepeat: number, public yrepeat: number, public absolute = false) { } }
export class Palette implements Message { constructor(public value: number, public max: number, public absolute = false) { } }
export class Flip implements Message { constructor() { } }
export class SpriteMode implements Message { }