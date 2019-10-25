import { InputState } from '../../../input';
import { info } from '../../../logger';
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
  ctx.state.register('frametime', 0);
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
  let events = context.poolMessages(state);
  for (let i = 0; i < events.length(); i++) {
    let e = events.get(i);
    info(e);
    handlers.handle(e, context);
  }
}

function draw() {
  context.gl.disable(WebGLRenderingContext.DEPTH_TEST);
  context.gl.enable(WebGLRenderingContext.BLEND);
  RENDER.list.clear();
  handlers.handle(RENDER, context);
  BGL.drawAll(context.gl, RENDER.list);
  context.gl.disable(WebGLRenderingContext.BLEND);
  context.gl.enable(WebGLRenderingContext.DEPTH_TEST);
}

export function handle(state: InputState, view: ViewPoint, dt: number) {
  context.state.set('frametime', dt);
  refreshHitscan(state, view)
  handlers.handle(FRAME, context);
  poolMessages(state)
  draw();
}
