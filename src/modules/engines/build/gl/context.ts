import { cyclic } from '../../../../libs/mathutils';
import { InputState } from '../../../input';
import { warning } from '../../../logger';
import { ArtProvider, BoardInvalidator, BuildContext, State, BoardManipulator } from '../api';
import { MessageHandlerReflective } from '../handlerapi';
import { Binder, loadBinds } from '../keymap';
import { Board } from '../structs';
import { NamedMessage } from '../edit/messages';
import { messageParser } from '../messageparser';


function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

class StateImpl implements State {
  private state: { [index: string]: any } = {};

  constructor(readonly ctx: Context) { }

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

export const VIEW_2D = 'view_2d';

export class Context extends MessageHandlerReflective implements BuildContext {
  readonly art: ArtProvider;
  readonly gl: WebGLRenderingContext;
  readonly state = new StateImpl(this);
  readonly boardManipulator: BoardManipulator;

  readonly binder = new Binder();
  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;
  private boardInt: Board;
  private invalidatorInt: BoardInvalidator;
  private boardBak: Board = null;
  private boardLast: Board = null;
  private boardLast1: Board = null;

  constructor(art: ArtProvider, board: Board, manipulator: BoardManipulator, gl: WebGLRenderingContext) {
    super();
    this.art = art;
    this.boardInt = board;
    this.gl = gl;
    this.boardManipulator = manipulator;
    this.commit();

    this.state.register('mouseX', 0);
    this.state.register('mouseY', 0);
    this.state.register('gridSize', 128);
    this.state.register(VIEW_2D, false);
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

  poolMessages(input: InputState) {
    this.state.set('mouseX', input.mouseX);
    this.state.set('mouseY', input.mouseY);
    this.binder.updateState(input, this.state);
    return this.binder.poolEvents(input);
  }

  switchViewMode() {
    let mode = this.state.get(VIEW_2D);
    this.state.set(VIEW_2D, !mode);
  }

  gridScale() {
    return this.gridSizes[this.gridSizeIdx];
  }

  incGridSize() {
    this.gridSizeIdx = cyclic(this.gridSizeIdx + 1, this.gridSizes.length);
    this.state.set('gridSize', this.gridScale());
  }

  decGridSize() {
    this.gridSizeIdx = cyclic(this.gridSizeIdx - 1, this.gridSizes.length);
    this.state.set('gridSize', this.gridScale());
  }

  snap(x: number) {
    return snapGrid(x, this.gridScale());
  }

  loadBinds(binds: string) {
    loadBinds(binds, this.binder, messageParser);
  }

  commit() {
    this.boardLast1 = this.boardLast;
    this.boardLast = this.boardManipulator.cloneBoard(this.boardInt);
  }

  backToLast() {
    if (this.boardLast1 == null) return;
    this.boardInt = this.boardLast1;
    this.invalidator.invalidateAll();
    this.boardLast = this.boardLast1;
    this.boardLast1 = null;
  }

  backup() {
    this.boardBak = this.boardManipulator.cloneBoard(this.boardInt);
  }

  restore() {
    if (this.boardBak == null) return;
    this.boardInt = this.boardBak;
    this.invalidator.invalidateAll();
    this.boardBak = null;
  }

  NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'grid+': this.incGridSize(); return;
      case 'grid-': this.decGridSize(); return;
      case 'view_mode': this.switchViewMode(); return;
      case 'undo': this.backToLast(); return;
    }
  }
}