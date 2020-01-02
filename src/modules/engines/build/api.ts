import { Texture } from "../../drawstruct";
import { ArtInfoProvider } from "./art";
import { Renderable } from "./gl/renderable";
import { Context, Message } from "./handlerapi";
import { Entity, Ray } from "./hitscan";
import { Board } from "./structs";
import { MoveStruct } from "./utils";

export interface ArtProvider extends ArtInfoProvider {
  get(picnum: number): Texture;
  getParallaxTexture(picnum: number): Texture
}

export interface Bindable {
  bind(ctx: BuildContext): void;
}

export interface Target {
  readonly coords: [number, number, number];
  readonly entity: Entity;
}

export interface View extends MoveStruct, Bindable {
  draw(renderable: Renderable): void;
  target(): Target;
  snapTarget(): Target;
  dir(): Ray;
  isWireframe(): boolean;
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
export const constCtxValue = <T>(value: T) => (ctx: BuildContext): T => value
export const stateCtxValue = <T>(name: string) => (ctx: BuildContext): T => ctx.state.get(name)

export interface BuildContext extends Context {
  readonly art: ArtProvider;
  readonly board: Board;
  readonly state: State;
  readonly gridScale: number;
  readonly view: View;

  snap(x: number): number;
  commit(): void;
  message(msg: Message): void;
}