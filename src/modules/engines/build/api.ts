import { Texture } from "../../drawstruct";
import { ArtInfoProvider } from "./art";
import { Context } from "./handlerapi";
import { Board } from "./structs";
import * as GLM from "../../../libs_js/glmatrix";
import { MoveStruct } from "./utils";
import { InputState } from "../../input";
import { Collection } from "../../deck";

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

export interface State {
  register<T>(name: string, defaultValue: T): void;
  set<T>(name: string, value: T): void;
  get<T>(name: string): T;
}

export interface Event { };

export interface Binder {
  match(input: InputState): Collection<Event>;
}

export interface BuildContext extends Context {
  readonly art: ArtProvider;
  readonly board: Board;
  readonly invalidator: BoardInvalidator;
  readonly gl: WebGLRenderingContext;
  readonly state: State;
  readonly binder: Binder;

  snap(x: number): number;
  snapScale(): number;
  scaledSnap(x: number, scale: number): number;
}