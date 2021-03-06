import { cyclic } from '../../../../libs/mathutils';
import { Deck } from '../../../collections';
import { InputState } from '../../../input';
import { error, warning } from '../../../logger';
import * as PROFILE from '../../../profiler';
import { State as StateGl } from '../../../stategl';
import { ArtProvider, Bindable, BoardManipulator, BuildContext, BuildReferenceTracker, State, View } from '../api';
import { BoardInvalidate, Frame, Mouse, NamedMessage, PostFrame, Render } from '../edit/messages';
import { Message, MessageHandler, MessageHandlerList, MessageHandlerReflective } from '../handlerapi';
import { Binder, loadBinds } from '../keymap';
import { messageParser } from '../messageparser';
import { ReferenceTrackerImpl } from '../referencetracker';
import { Board } from '../structs';
import { LayeredRenderable, RenderablesProvider, SortingRenderable, WrapRenderable, consumerProvider } from './builders/renderable';

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

const tools = consumerProvider<LayeredRenderable>();

const FRAME = new Frame(0);
const POSTFRAME = new PostFrame();
const MOUSE = new Mouse(0, 0);
const RENDER = new Render(tools.consumer);
const INVALIDATE_ALL = new BoardInvalidate(null);

const onTopRenderable = new WrapRenderable(new SortingRenderable(tools.provider),
  (ctx: BuildContext, gl: WebGLRenderingContext, state: StateGl) => {
    gl.disable(WebGLRenderingContext.DEPTH_TEST);
    gl.enable(WebGLRenderingContext.BLEND);
  },
  (ctx: BuildContext, gl: WebGLRenderingContext, state: StateGl) => {
    gl.disable(WebGLRenderingContext.BLEND);
    gl.enable(WebGLRenderingContext.DEPTH_TEST);
  });

class BuildReferenceTrackerImpl implements BuildReferenceTracker {
  readonly walls = new ReferenceTrackerImpl<number>(-1);
  readonly sectors = new ReferenceTrackerImpl<number>(-1);
  readonly sprites = new ReferenceTrackerImpl<number>(-1);
}

export class GridController {
  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;

  public setGridSize(size: number) {
    if (size < this.gridSizes[0]) this.gridSizeIdx = 0;
    else if (size > this.gridSizes[this.gridSizes.length - 1]) this.gridSizeIdx = this.gridSizes.length - 1;
    else {
      for (let i = 0; i < this.gridSizes.length - 2; i++) {
        const i1 = i + 1;
        if (size > this.gridSizes[i1]) continue;
        this.gridSizeIdx = (size - this.gridSizes[i]) < (this.gridSizes[i1] - size) ? i : i1;
        break;
      }
    }
  }

  public getGridSize(): number { return this.gridSizes[this.gridSizeIdx] }
  public incGridSize() { this.gridSizeIdx = cyclic(this.gridSizeIdx + 1, this.gridSizes.length) }
  public decGridSize() { this.gridSizeIdx = cyclic(this.gridSizeIdx - 1, this.gridSizes.length) }
}

export class Context extends MessageHandlerReflective implements BuildContext {
  readonly art: ArtProvider;
  readonly state = new StateImpl(this);
  readonly view: View;
  readonly refs = new BuildReferenceTrackerImpl();

  private binder = new Binder();
  private history: History = new History();
  private activeBoard: Board;
  private boardManipulator: BoardManipulator;
  private handlers = new MessageHandlerList();
  private boundObjects = new Set();
  private gridController: GridController;

  constructor(art: ArtProvider, board: Board, view: View, manipulator: BoardManipulator, gridController: GridController = new GridController()) {
    super();
    this.art = art;
    this.boardManipulator = manipulator;
    this.gridController = gridController;
    this.activeBoard = board;
    this.view = this.bind(view);
    this.commit();

    this.state.register('gridScale', this.gridScale);
  }

  get board() {
    return this.activeBoard;
  }

  get gridScale() {
    return this.gridController.getGridSize();
  }

  private bind<T extends Bindable>(bindable: T): T {
    if (!this.boundObjects.has(bindable)) {
      bindable.bind(this);
      this.boundObjects.add(bindable);
    }
    return bindable;
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

  private incGridSize() {
    this.gridController.incGridSize();
    this.state.set('gridScale', this.gridScale);
  }

  private decGridSize() {
    this.gridController.decGridSize();
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
    tools.clear();
    this.handle(RENDER, this);
    this.view.draw(onTopRenderable);
  }

  private undo() {
    this.history.pop();
    this.activeBoard = this.boardManipulator.cloneBoard(this.history.top());
    this.message(INVALIDATE_ALL);
  }

  addHandler(handler: MessageHandler): void
  addHandler(handler: MessageHandler & Bindable): void {
    if (handler.bind != undefined) this.bind(handler);
    this.handlers.list().push(handler);
  }

  message(msg: Message) {
    this.handle(msg, this);
  }

  handle(msg: Message, ctx: BuildContext) {
    try {
      // info(msg);
      super.handle(msg, ctx);
      this.handlers.handle(msg, ctx);
    } catch (e) {
      error(e, e.stack);
    }
  }

  frame(input: InputState, dt: number) {
    PROFILE.start();
    this.mouseMove(input);
    FRAME.dt = dt;
    this.message(FRAME);
    for (let contextedMessage of this.poolMessages(input)) {
      let message = contextedMessage(this);
      this.message(message);
    }
    this.drawTools();
    PROFILE.endProfile();
    this.message(POSTFRAME);
  }

  NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'grid+': this.incGridSize(); return;
      case 'grid-': this.decGridSize(); return;
      case 'undo': this.undo(); return;
    }
  }
}