import { Deck } from "../../../deck";
import { Texture } from "../../../drawstruct";
import { ArtInfoProvider } from "../art";
import { Renderable } from "../gl/renderable";
import { Context, Message } from "../messages";
import { Board } from "../structs";
import { MovingHandle } from "./handle";

export interface ArtProvider extends ArtInfoProvider {
  get(picnum: number): Texture;
  getParallaxTexture(picnum: number): Texture
}

export interface SectorRenderable extends Renderable {
  ceiling: Renderable;
  floor: Renderable;
}

export interface WallRenderable extends Renderable {
  top: Renderable;
  mid: Renderable;
  bot: Renderable;
}

export interface BuildRenderableProvider {
  sector(id: number): SectorRenderable;
  wall(id: number): WallRenderable;
  wallPoint(id: number): Renderable;
  sprite(id: number): Renderable;
}

export interface BoardInvalidator {
  invalidateAll(): void;
  invalidateSector(id: number): void;
  invalidateWall(id: number): void;
  invalidateSprite(id: number): void;
}

export interface BuildContext extends Context {
  readonly art: ArtProvider;
  readonly board: Board;
  readonly invalidator: BoardInvalidator;
  readonly gl: WebGLRenderingContext;

  snap(x: number): number;
  snapScale(): number;
  scaledSnap(x: number, scale: number): number;
}

export class StartMove implements Message { constructor(public handle: MovingHandle) { } }
export class Move implements Message { constructor(public handle: MovingHandle) { } }
export class EndMove implements Message { constructor(public handle: MovingHandle) { } }
export class Highlight implements Message { constructor(public list: Deck<number> = new Deck()) { } }
export class SetPicnum implements Message { constructor(public picnum: number) { } }
export class ToggleParallax implements Message { }
export class Shade implements Message { constructor(public value: number, public absolute = false) { } }
export class PanRepeat implements Message { constructor(public xpan: number, public ypan: number, public xrepeat: number, public yrepeat: number, public absolute = false) { } }
export class Palette implements Message { constructor(public value: number, public max: number, public absolute = false) { } }
export class Flip implements Message { constructor() { } }
export class SpriteMode implements Message { }