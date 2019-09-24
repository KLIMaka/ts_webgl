import { Texture } from "../../drawstruct";
import { ArtInfoProvider } from "./art";
import { Renderable } from "./gl/renderable";
import { Context } from "./messages";
import { Board } from "./structs";

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