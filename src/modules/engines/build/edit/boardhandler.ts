import { InputState } from '../../../input';
import * as PROFILE from '../../../profiler';
import { ViewPoint } from '../api';
import * as BGL from '../gl/buildgl';
import { Context } from '../gl/context';
import { hitscan, Hitscan } from '../hitscan';
import { MessageHandler, MessageHandlerList } from '../messages';
import * as U from '../utils';
import { HitScan, Input, Render } from './editapi';
import { snap } from './editutils';

const HITSCAN = new HitScan(new Hitscan());
const INPUT = new Input(null, 0);
const RENDER = new Render();

let context: Context;
export function init(ctx: Context) {
  context = ctx;
}

let handlers = new MessageHandlerList();
export function addHandler(handler: MessageHandler) {
  handlers.add(handler);
}

function refreshHitscan(state: InputState, view: ViewPoint) {
  PROFILE.startProfile('hitscan');
  let [vx, vz, vy] = view.unproject(context.gl, state.mouseX, state.mouseY);
  hitscan(context.board, context.art, view.x, view.y, view.z, view.sec, vx, vy, vz, HITSCAN.hit, 0);
  PROFILE.endProfile();
  let [x, y] = snap(HITSCAN.hit, context);
  BGL.setCursorPosiotion(x, HITSCAN.hit.z / U.ZSCALE, y);
}

function drawHelpers() {
  context.gl.disable(WebGLRenderingContext.DEPTH_TEST);
  context.gl.enable(WebGLRenderingContext.BLEND);
  RENDER.list.clear();
  handlers.handle(RENDER, context);
  BGL.drawAll(context.gl, RENDER.list);
  context.gl.disable(WebGLRenderingContext.BLEND);
  context.gl.enable(WebGLRenderingContext.DEPTH_TEST);
}

export function handle(state: InputState, view: ViewPoint, dt: number) {
  refreshHitscan(state, view);
  INPUT.state = state;
  INPUT.dt = dt;
  handlers.handle(HITSCAN, context);
  handlers.handle(INPUT, context);
  drawHelpers();
}