import { cyclic } from '../../../../libs/mathutils';
import { InputState } from '../../../input';
import { warning } from '../../../logger';
import { ArtProvider, BoardInvalidator, BuildContext, State } from '../api';
import { MessageHandlerReflective } from '../handlerapi';
import { Binder, loadBinds } from '../keymap';
import { Board } from '../structs';
import { NamedMessage } from '../edit/messages';
import { messageParser } from '../events';


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
  readonly binder = new Binder();

  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;
  private boardInt: Board;
  private invalidatorInt: BoardInvalidator;

  constructor(art: ArtProvider, board: Board, gl: WebGLRenderingContext) {
    super();
    this.art = art;
    this.boardInt = board;
    this.gl = gl;

    this.state.register('mouseX', 0);
    this.state.register('mouseY', 0);
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

  addBind(event: Event, key: string, ...mods: string[]): void {
    this.binder.addBind(event, key, ...mods);
  }

  loadBinds(binds: string) {
    loadBinds(binds, this.binder, messageParser);
  }

  NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'grid+': this.incGridSize(); return;
      case 'grid-': this.decGridSize(); return;
    }
  }
}