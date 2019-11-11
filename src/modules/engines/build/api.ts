import { Texture } from "../../drawstruct";
import { ArtInfoProvider } from "./art";
import { Context, Message } from "./handlerapi";
import { Board, Sector, Wall } from "./structs";
import * as GLM from "../../../libs_js/glmatrix";
import { MoveStruct } from "./utils";
import { InputState } from "../../input";
import { Collection } from "../../collections";

export interface ArtProvider extends ArtInfoProvider {
  get(picnum: number): Texture;
  getParallaxTexture(picnum: number): Texture
}

export interface ViewPoint extends MoveStruct {
  getProjectionMatrix(): GLM.Mat4Array;
  getTransformMatrix(): GLM.Mat4Array;
  getPosition(): GLM.Vec3Array;
  getForward(): GLM.Vec3Array;
  unproject(x: number, y: number): GLM.Vec3Array;
}

export interface BoardInvalidator {
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
  readonly boardManipulator: BoardManipulator;
  readonly invalidator: BoardInvalidator;
  readonly gl: WebGLRenderingContext;
  readonly state: State;

  poolMessages(input: InputState): Collection<ContextedValue<Message>>;
  snap(x: number): number;
  gridScale(): number;

  backup(): void;
  restore(): void;
}