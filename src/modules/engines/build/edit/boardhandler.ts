import { InputState } from '../../../input';
import { info, error } from '../../../logger';
import * as PROFILE from '../../../profiler';
import { BuildContext, ViewPoint } from '../api';
import * as BGL from '../gl/buildgl';
import { MessageHandler, MessageHandlerList } from '../handlerapi';
import { hitscan, Hitscan } from '../hitscan';
import * as U from '../utils';
import { snap } from './editutils';
import { Frame, Render } from './messages';

const hit = new Hitscan();
const RENDER = new Render();
const FRAME = new Frame(0);


let context: BuildContext;
export function init(ctx: BuildContext) {
  ctx.state.register('hitscan', hit);
  context = ctx;
}

let handlers = new MessageHandlerList();
export function addHandler(handler: MessageHandler) {
  handlers.list().push(handler);
}

function refreshHitscan(state: InputState, view: ViewPoint): void {
  PROFILE.startProfile('hitscan');
  let x = (state.mouseX / context.gl.drawingBufferWidth) * 2 - 1;
  let y = (state.mouseY / context.gl.drawingBufferHeight) * 2 - 1;
  let [vx, vz, vy] = view.unproject(x, y);
  hitscan(context.board, context.art, view.x, view.y, view.z, view.sec, vx, vy, vz, hit, 0);
  PROFILE.endProfile();
  if (hit.t != -1) {
    let [x, y] = snap(context);
    BGL.setCursorPosiotion(x, hit.z / U.ZSCALE, y);
  }
}

function poolMessages(state: InputState): void {
  for (let contextedMessage of context.poolMessages(state)) {
    let message = contextedMessage(context);
    try {
      context.backup();
      info(message);
      handlers.handle(message, context);
    } catch (e) {
      error(e);
      context.restore();
    }
  }
}

function draw() {
  context.gl.disable(WebGLRenderingContext.DEPTH_TEST);
  context.gl.enable(WebGLRenderingContext.BLEND);
  RENDER.list.clear();
  handlers.handle(RENDER, context);
  BGL.drawAll(context, RENDER.list);
  context.gl.disable(WebGLRenderingContext.BLEND);
  context.gl.enable(WebGLRenderingContext.DEPTH_TEST);
}

export function handle(state: InputState, view: ViewPoint, dt: number) {
  refreshHitscan(state, view);
  FRAME.dt = dt;
  handlers.handle(FRAME, context);
  poolMessages(state)
  draw();
}
