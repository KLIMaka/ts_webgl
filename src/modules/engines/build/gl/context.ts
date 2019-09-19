import { cyclic } from '../../../../libs/mathutils';
import { ArtProvider, BuildContext, BoardInvalidator } from '../edit/editapi';
import { Board } from '../structs';


function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

export class Context implements BuildContext {
  readonly art: ArtProvider;
  readonly gl: WebGLRenderingContext;

  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;
  private boardInt: Board;
  private invalidatorInt: BoardInvalidator;

  constructor(art: ArtProvider, board: Board, gl: WebGLRenderingContext) {
    this.art = art;
    this.boardInt = board;
    this.gl = gl;
  }

  get invalidator() {
    return this.invalidatorInt;
  }

  get board() {
    return this.boardInt;
  }

  setBoard(board: Board) {
    this.boardInt = board;
    this.invalidatorInt.invalidateAll();
  }

  setBoardInvalidator(inv: BoardInvalidator) {
    this.invalidatorInt = inv;
  }

  snapScale() {
    return this.gridSizes[this.gridSizeIdx];
  }

  incGridSize() {
    this.gridSizeIdx = cyclic(this.gridSizeIdx + 1, this.gridSizes.length);
  }

  decGridSize() {
    this.gridSizeIdx = cyclic(this.gridSizeIdx - 1, this.gridSizes.length);
  }

  snap(x: number) {
    return snapGrid(x, this.snapScale());
  }

  scaledSnap(x: number, scale: number) {
    return snapGrid(x, this.gridSizes[this.gridSizeIdx] * scale);
  }

}