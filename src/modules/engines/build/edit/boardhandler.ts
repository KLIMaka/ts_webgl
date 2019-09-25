import { Controller3D } from '../../../controller3d';
import { InputState } from '../../../input';
import * as PROFILE from '../../../profiler';
import * as BGL from '../gl/buildgl';
import { Context } from '../gl/context';
import { BuildRenderableProvider } from '../gl/renderable';
import { hitscan, Hitscan } from '../hitscan';
import { MessageHandler, MessageHandlerList } from '../messages';
import * as U from '../utils';
import { HitScan, Input, Render } from './editapi';
import { snap } from './editutils';

const HITSCAN = new HitScan(new Hitscan());
const INPUT = new Input(null);
const RENDER = new Render();

let context: Context;
export function init(ctx: Context) {
  context = ctx;
}

let handlers = new MessageHandlerList();
export function addHandler(handler: MessageHandler) {
  handlers.add(handler);
}

function refreshHitscan(state: InputState, ms: U.MoveStruct, ctr: Controller3D) {
  PROFILE.startProfile('hitscan');
  let [vx, vz, vy] = ctr.getForwardUnprojected(context.gl, state.mouseX, state.mouseY);
  hitscan(context.board, context.art, ms.x, ms.y, ms.z, ms.sec, vx, vy, vz, HITSCAN.hit, 0);
  PROFILE.endProfile();
  let [x, y] = snap(HITSCAN.hit, context);
  BGL.setCursorPosiotion(x, HITSCAN.hit.z / U.ZSCALE, y);
}

function drawHelpers(r: BuildRenderableProvider) {
  context.gl.disable(WebGLRenderingContext.DEPTH_TEST);
  context.gl.enable(WebGLRenderingContext.BLEND);
  RENDER.list.clear();
  handlers.handle(RENDER, context);
  BGL.drawAll(context.gl, RENDER.list);
  context.gl.disable(WebGLRenderingContext.BLEND);
  context.gl.enable(WebGLRenderingContext.DEPTH_TEST);
}

export function handle(state: InputState, r: BuildRenderableProvider, ms: U.MoveStruct, ctr: Controller3D, dt: number) {
  refreshHitscan(state, ms, ctr);
  INPUT.state = state;
  handlers.handle(HITSCAN, context);
  handlers.handle(INPUT, context);

  drawHelpers(r);

  if (state.keysPress['[']) context.incGridSize();
  if (state.keysPress[']']) context.decGridSize();
  if (state.keys['W']) ctr.moveForward(dt * 8000);
  if (state.keys['S']) ctr.moveForward(-dt * 8000);
  if (state.keys['A']) ctr.moveSideway(-dt * 8000);
  if (state.keys['D']) ctr.moveSideway(dt * 8000);
  ctr.track(state.mouseX, state.mouseY, state.mouseButtons[2]);
}