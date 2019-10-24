import { EventQueue } from '../../../eventqueue';
import { InputState } from '../../../input';
import { warning, info } from '../../../logger';
import * as PROFILE from '../../../profiler';
import { BuildContext, ViewPoint } from '../api';
import * as BGL from '../gl/buildgl';
import { MessageHandler, MessageHandlerList } from '../handlerapi';
import { hitscan, Hitscan } from '../hitscan';
import * as U from '../utils';
import { snap } from './editutils';
import { EventBus, HitScan, Render, Frame } from './messages';

const HITSCAN = new HitScan(new Hitscan());
const RENDER = new Render();
const EVENT_BUS = new EventBus(new EventQueue());
const FRAME = new Frame(0);


let context: BuildContext;
export function init(ctx: BuildContext) {
  ctx.state.register('frametime', 0);
  context = ctx;
}

let handlers = new MessageHandlerList();
export function addHandler(handler: MessageHandler) {
  handlers.list().push(handler);
}

function refreshHitscan(state: InputState, view: ViewPoint) {
  PROFILE.startProfile('hitscan');
  let x = (state.mouseX / context.gl.drawingBufferWidth) * 2 - 1;
  let y = (state.mouseY / context.gl.drawingBufferHeight) * 2 - 1;
  let [vx, vz, vy] = view.unproject(x, y);
  hitscan(context.board, context.art, view.x, view.y, view.z, view.sec, vx, vy, vz, HITSCAN.hit, 0);
  PROFILE.endProfile();
  if (HITSCAN.hit.t != -1) {
    let [x, y] = snap(HITSCAN.hit, context);
    BGL.setCursorPosiotion(x, HITSCAN.hit.z / U.ZSCALE, y);
  }
  return HITSCAN;
}

function poolEvents(state: InputState): boolean {
  let queue = EVENT_BUS.events;
  // reportUnconsumed(queue);
  queue.clear();
  let events = context.poolEvents(state);
  for (let i = 0; i < events.length(); i++) {
    let e = events.get(i);
    info(e);
    queue.add(e);
  }
  return !queue.isEmpty();
}

function reportUnconsumed(queue: EventQueue) {
  for (let i = queue.first(); i != -1; queue.next(i)) {
    let e = queue.get(i);
    warning(`Unconsumed event ${e}`);
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
  handlers.handle(refreshHitscan(state, view), context);
  handlers.handle(FRAME, context);
  if (poolEvents(state)) handlers.handle(EVENT_BUS, context);
  draw();
}
