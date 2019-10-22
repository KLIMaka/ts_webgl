import { cyclic } from '../../../../libs/mathutils';
import { ArtProvider, BuildContext, BoardInvalidator } from '../api';
import { Board } from '../structs';
import { MessageHandlerReflective } from '../handlerapi';
import { Input } from '../edit/messages';
import { action } from '../../../keymap';


function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

export class Context extends MessageHandlerReflective implements BuildContext {
  readonly art: ArtProvider;
  readonly gl: WebGLRenderingContext;

  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;
  private boardInt: Board;
  private invalidatorInt: BoardInvalidator;

  constructor(art: ArtProvider, board: Board, gl: WebGLRenderingContext) {
    super();
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

  Input(msg: Input, ctx: BuildContext) {
    if (action('grid+', msg.state)) this.incGridSize();
    if (action('grid-', msg.state)) this.decGridSize();
  }
}