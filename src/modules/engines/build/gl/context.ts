import { cyclic } from '../../../../libs/mathutils';
import { InputState } from '../../../input';
import { warning, error, info } from '../../../logger';
import { ArtProvider, BoardInvalidator, BuildContext, State, BoardManipulator, View } from '../api';
import { State as StateGl } from '../../../stategl';
import { MessageHandlerReflective, MessageHandlerList, Message, MessageHandler } from '../handlerapi';
import { Binder, loadBinds } from '../keymap';
import { Board } from '../structs';
import { NamedMessage, Frame, PostFrame, Mouse, Render } from '../edit/messages';
import { messageParser } from '../messageparser';
import { Deck } from '../../../collections';
import { Hitscan, hitscan } from '../hitscan';
import * as PROFILE from '../../../profiler';
import * as BGL from './buildgl';
import { snap } from '../edit/editutils';
import { ZSCALE } from '../utils';
import { WrapRenderable } from './renderable';

class History {
  private history: Deck<Board> = new Deck();

  public push(board: Board) { this.history.push(board) }
  public pop() { if (this.history.length() > 1) this.history.pop() }
  public top() { return this.history.top() }
}


function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

class StateImpl implements State {
  private state: { [index: string]: any } = {};

  constructor(readonly ctx: Context) { }

  register<T>(name: string, defaultValue: T): void {
    let prevState = this.state[name];
    if (prevState != undefined) warning(`Redefining state ${name}`, new Error().stack);
    this.state[name] = defaultValue;
  }

  set<T>(name: string, value: T): void {
    if (this.get(name) == undefined) return;
    this.state[name] = value;
  }

  get<T>(name: string): T {
    let stateValue = this.state[name];
    if (stateValue == undefined) warning(`State ${name} is unregistered`, new Error().stack);
    return stateValue;
  }
}

export const VIEW_2D = 'view_2d';
const FRAME = new Frame(0);
const POSTFRAME = new PostFrame();
const MOUSE = new Mouse(0, 0);
const RENDER = new Render();

const onTopRenderable = new WrapRenderable(RENDER.renderable,
  (ctx: BuildContext, gl: WebGLRenderingContext, state: StateGl) => {
    gl.disable(WebGLRenderingContext.DEPTH_TEST);
    gl.enable(WebGLRenderingContext.BLEND);
  },
  (ctx: BuildContext, gl: WebGLRenderingContext, state: StateGl) => {
    gl.disable(WebGLRenderingContext.BLEND);
    gl.enable(WebGLRenderingContext.DEPTH_TEST);
  });


export class Context extends MessageHandlerReflective implements BuildContext {
  readonly art: ArtProvider;
  readonly state = new StateImpl(this);
  readonly hitscan = new Hitscan();
  readonly view: View;
  readonly invalidator: BoardInvalidator;

  readonly binder = new Binder();
  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;
  private history: History = new History();
  private activeBoard: Board;
  private boardManipulator: BoardManipulator;
  private handlers = new MessageHandlerList();

  constructor(art: ArtProvider, board: Board, view: View, inv: BoardInvalidator, manipulator: BoardManipulator) {
    super();
    this.art = art;
    this.boardManipulator = manipulator;
    this.activeBoard = board;
    this.view = view;
    this.view.bind(this);
    this.invalidator = inv;
    this.invalidator.bind(this);
    this.commit();

    this.state.register('gridScale', this.gridScale);
    this.state.register(VIEW_2D, false);
    this.state.register('hitscan', this.hitscan);
  }

  get board() {
    return this.activeBoard;
  }

  private updateHitscan() {
    PROFILE.startProfile('hitscan');
    this.view.hitscan(this, this.hitscan);
    PROFILE.endProfile();
    if (this.hitscan.t != -1) {
      let [x, y] = snap(this);
      BGL.setCursorPosiotion(x, this.hitscan.z / ZSCALE, y);
    }
  }

  private mouseMove(input: InputState) {
    if (MOUSE.x == input.mouseX && MOUSE.y == input.mouseY) return;
    MOUSE.x = input.mouseX;
    MOUSE.y = input.mouseY;
    this.handle(MOUSE, this);
  }

  private poolMessages(input: InputState) {
    this.binder.updateState(input, this.state);
    return this.binder.poolEvents(input);
  }

  private switchViewMode() {
    let mode = this.state.get(VIEW_2D);
    this.state.set(VIEW_2D, !mode);
  }

  get gridScale() {
    return this.gridSizes[this.gridSizeIdx];
  }

  private incGridSize() {
    this.gridSizeIdx = cyclic(this.gridSizeIdx + 1, this.gridSizes.length);
    this.state.set('gridScale', this.gridScale);
  }

  private decGridSize() {
    this.gridSizeIdx = cyclic(this.gridSizeIdx - 1, this.gridSizes.length);
    this.state.set('gridScale', this.gridScale);
  }

  snap(x: number) {
    return snapGrid(x, this.gridScale);
  }

  loadBinds(binds: string) {
    loadBinds(binds, this.binder, messageParser);
  }

  commit() {
    this.history.push(this.boardManipulator.cloneBoard(this.activeBoard));
  }

  private drawTools() {
    RENDER.list.clear();
    this.handle(RENDER, this);
    this.view.draw(onTopRenderable);
  }

  private undo() {
    this.history.pop();
    this.activeBoard = this.boardManipulator.cloneBoard(this.history.top());
    this.invalidator.invalidateAll();
  }

  addHandler(handler: MessageHandler) {
    this.handlers.list().push(handler);
  }

  handle(msg: Message, ctx: BuildContext) {
    try {
      // info(msg);
      super.handle(msg, ctx);
      this.handlers.handle(msg, ctx);
    } catch (e) {
      error(e);
    }
  }

  frame(input: InputState, dt: number) {
    PROFILE.start();
    this.updateHitscan();
    this.mouseMove(input);
    FRAME.dt = dt;
    this.handle(FRAME, this);
    for (let contextedMessage of this.poolMessages(input)) {
      let message = contextedMessage(this);
      this.handle(message, this);
    }
    this.drawTools();
    PROFILE.endProfile();
    this.handle(POSTFRAME, this);
  }

  NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'grid+': this.incGridSize(); return;
      case 'grid-': this.decGridSize(); return;
      case 'view_mode': this.switchViewMode(); return;
      case 'undo': this.undo(); return;
    }
  }
}