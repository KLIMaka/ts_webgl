import { Texture } from "../../drawstruct";
import { ArtInfoProvider } from "./art";
import { Context } from "./messages";
import { Board } from "./structs";
import * as GLM from "../../../libs_js/glmatrix";
import { MoveStruct } from "./utils";

export interface ArtProvider extends ArtInfoProvider {
  get(picnum: number): Texture;
  getParallaxTexture(picnum: number): Texture
}

export interface ViewPoint extends MoveStruct {
  getProjectionMatrix(gl: WebGLRenderingContext): GLM.Mat4Array;
  getTransformMatrix(): GLM.Mat4Array;
  getPosition(): GLM.Vec3Array;
  getForward(): GLM.Vec3Array;
  unproject(gl: WebGLRenderingContext, x: number, y: number): GLM.Vec3Array;
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