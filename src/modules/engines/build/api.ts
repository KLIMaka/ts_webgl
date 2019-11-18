import { Texture } from "../../drawstruct";
import { ArtInfoProvider } from "./art";
import { Renderable } from "./gl/renderable";
import { Context } from "./handlerapi";
import { Hitscan } from "./hitscan";
import { Board } from "./structs";
import { MoveStruct } from "./utils";

export interface ArtProvider extends ArtInfoProvider {
  get(picnum: number): Texture;
  getParallaxTexture(picnum: number): Texture
}

export interface Bindable {
  bind(ctx: BuildContext): void;
}

export interface View extends MoveStruct, Bindable {
  draw(renderable: Renderable): void;
  hitscan(ctx: BuildContext, hitscan: Hitscan): Hitscan;
}

export interface BoardInvalidator extends Bindable {
  invalidateAll(): void;
  invalidateSector(id: number): void;
  invalidateWall(id: number): void;
  invalidateSprite(id: number): void;
}

export interface BoardManipulator {
  cloneBoard(board: Board): Board;
}

export interface State {
  register<T>(name: string, defaultValue: T): void;
  set<T>(name: string, value: T): void;
  get<T>(name: string): T;
}

export type ContextedValue<T> = (ctx: BuildContext) => T;
export const constCtxValue = <T>(value: T) => (ctx: BuildContext) => value
export const stateCtxValue = <T>(name: string) => (ctx: BuildContext) => ctx.state.get(name)

export interface BuildContext extends Context {
  readonly art: ArtProvider;
  readonly board: Board;
  readonly invalidator: BoardInvalidator;
  readonly state: State;
  readonly hitscan: Hitscan;
  readonly gridScale: number;
  readonly view: View;

  snap(x: number): number;
  commit(): void;
}