import { cyclic } from '../../../../libs/mathutils';
import { ArtProvider, BuildContext, BoardInvalidator, State } from '../api';
import { Board } from '../structs';
import { MessageHandlerReflective } from '../handlerapi';
import { Input } from '../edit/messages';
import { action } from '../../../keymap';
import { warning } from '../../../logger';


function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

class StateImpl implements State {
  private state: { [index: string]: any } = {};

  register<T>(name: string, defaultValue: T): void {
    let prevState = this.state[name];
    if (prevState != undefined) warning(`Redefining state ${name}`);
    this.state[name] = defaultValue;
  }

  set<T>(name: string, value: T): void {
    if (this.get(name) == undefined) return;
    this.state[name] = value;
  }

  get<T>(name: string): T {
    let stateValue = this.state[name];
    if (stateValue == undefined) warning(`State ${name} is unregistered`);
    return stateValue;
  }
}

export class Context extends MessageHandlerReflective implements BuildContext {
  readonly art: ArtProvider;
  readonly gl: WebGLRenderingContext;
  readonly state = new StateImpl();

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