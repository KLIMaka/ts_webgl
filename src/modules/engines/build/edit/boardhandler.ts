import { detuple0, detuple1 } from '../../../../libs/mathutils';
import { Controller3D } from '../../../controller3d';
import { Deck } from '../../../deck';
import * as INPUT from '../../../input';
import * as PROFILE from '../../../profiler';
import * as BU from '../boardutils';
import * as BGL from '../gl/buildgl';
import { Context } from '../gl/context';
import { Renderable } from '../gl/renderable';
import { hitscan, Hitscan, isSector, isWall, SubType } from '../hitscan';
import { Message, MessageHandlerList } from '../messages';
import * as U from '../utils';
import * as EDIT from "./edit";
import { snap } from './editutils';
import { BuildRenderableProvider } from '../api';

export type PicNumCallback = (picnum: number) => void;
export type PicNumSelector = (cb: PicNumCallback) => void;

let context: Context;
let selection = new MessageHandlerList();
let hit = new Hitscan();
let picnumSelector: PicNumSelector;

export function init(ctx: Context, selector: PicNumSelector) {
  context = ctx;
  picnumSelector = selector;
}

function setTexture() {
  let sel = selection.clone();
  picnumSelector((picnum: number) => {
    if (picnum == -1) return;
    EDIT.SET_PICNUM.picnum = picnum;
    sel.handle(EDIT.SET_PICNUM, context);
  })
}

function sendToSelected(msg: Message) {
  selection.handle(msg, context);
}

function sendShadeChange(value: number) {
  EDIT.SHADE_CHANGE.value = value * (INPUT.keys['SHIFT'] ? 8 : 1);
  sendToSelected(EDIT.SHADE_CHANGE);
}

function sendPanRepeat(x: number, y: number) {
  if (INPUT.keys['CTRL']) {
    EDIT.PANREPEAT.xpan = EDIT.PANREPEAT.ypan = 0;
    EDIT.PANREPEAT.xrepeat = x * (INPUT.keys['SHIFT'] ? 1 : 8);
    EDIT.PANREPEAT.yrepeat = y * (INPUT.keys['SHIFT'] ? 1 : 8);
  } else {
    EDIT.PANREPEAT.xrepeat = EDIT.PANREPEAT.yrepeat = 0;
    EDIT.PANREPEAT.xpan = x * (INPUT.keys['SHIFT'] ? 1 : 8);
    EDIT.PANREPEAT.ypan = y * (INPUT.keys['SHIFT'] ? 1 : 8);
  }
  sendToSelected(EDIT.PANREPEAT);
}

function insertSprite() {
  let [x, y] = snap(hit, context);
  if (!isSector(hit.type)) return;
  picnumSelector((picnum: number) => {
    if (picnum == -1) return;
    let spriteId = BU.insertSprite(context.board, x, y, hit.z);
    context.board.sprites[spriteId].picnum = picnum;
  });
}

function print(id: number, type: SubType) {
  if (INPUT.mouseClicks[0]) {
    switch (type) {
      case SubType.CEILING:
      case SubType.FLOOR:
        console.log(id, context.board.sectors[id]);
        break;
      case SubType.UPPER_WALL:
      case SubType.MID_WALL:
      case SubType.LOWER_WALL:
        console.log(id, context.board.walls[id]);
        break;
      case SubType.SPRITE:
        console.log(id, context.board.sprites[id]);
        break;
    }
  }
}

function pointerHitscan(ms: U.MoveStruct, ctr: Controller3D) {
  PROFILE.startProfile('hitscan');
  let [vx, vz, vy] = ctr.getForwardUnprojected(context.gl, INPUT.mouseX, INPUT.mouseY);
  hitscan(context.board, context.art, ms.x, ms.y, ms.z, ms.sec, vx, vy, vz, hit, 0);
  PROFILE.endProfile();
}

function move(ctr: Controller3D) {
  if (selection.isEmpty()) return;

  let fwd = ctr.getForwardUnprojected(context.gl, INPUT.mouseX, INPUT.mouseY);
  let pos = ctr.getCamera().getPosition();
  EDIT.MOVE.handle.update(pos, fwd, INPUT.keys['SHIFT'], INPUT.keys['ALT'], INPUT.keys['CTRL'], hit, context.board);

  if (!EDIT.MOVE.handle.isActive() && INPUT.mouseButtons[0]) {
    EDIT.MOVE.handle.start(hit);
    sendToSelected(EDIT.START_MOVE);
  } else if (!INPUT.mouseButtons[0]) {
    EDIT.MOVE.handle.stop();
    sendToSelected(EDIT.END_MOVE);
    return;
  }

  sendToSelected(EDIT.MOVE);
}

function updateCursor() {
  EDIT.SPLIT_WALL.deactivate();
  EDIT.DRAW_SECTOR.update(context.board, hit, context);
  if (hit.t != -1) {
    let [x, y] = snap(hit, context);
    BGL.setCursorPosiotion(x, hit.z / U.ZSCALE, y);
    if (isWall(hit.type)) EDIT.SPLIT_WALL.update(x, y, hit.id);
  }
}

function select() {
  if (EDIT.MOVE.handle.isActive())
    return;

  selection.clear();
  let list = EDIT.getFromHitscan(context.board, hit, context, INPUT.keys['TAB']);
  for (let i = 0; i < list.length(); i++) {
    selection.add(list.get(i));
  }

  print(hit.id, hit.type);
}

let drawlist = new Deck<Renderable>();
function drawHelpers(r: BuildRenderableProvider) {
  context.gl.disable(WebGLRenderingContext.DEPTH_TEST);
  context.gl.enable(WebGLRenderingContext.BLEND);
  EDIT.HIGHLIGHT.set.clear();
  sendToSelected(EDIT.HIGHLIGHT);
  drawlist.clear();
  for (let v of EDIT.HIGHLIGHT.set.keys()) {
    let type = detuple0(v);
    let id = detuple1(v);
    switch (type) {
      case 0: drawlist.push(r.sector(id).ceiling); break;
      case 1: drawlist.push(r.sector(id).floor); break;
      case 2: drawlist.push(r.wall(id)); break;
      case 3: drawlist.push(r.wallPoint(id)); break;
      case 4: drawlist.push(r.sprite(id)); break;
    }
  }
  BGL.drawAll(context.gl, drawlist);
  BGL.draw(context.gl, EDIT.DRAW_SECTOR.getRenderable());
  context.gl.disable(WebGLRenderingContext.BLEND);
  context.gl.enable(WebGLRenderingContext.DEPTH_TEST);
}

export function handle(r: BuildRenderableProvider, ms: U.MoveStruct, ctr: Controller3D, dt: number) {
  pointerHitscan(ms, ctr);
  select();
  move(ctr);
  updateCursor();

  drawHelpers(r);

  if (INPUT.keys['CTRL'] && INPUT.mouseClicks[0]) EDIT.SPLIT_WALL.run(context);
  if (INPUT.keysPress['SPACE']) EDIT.DRAW_SECTOR.insertPoint(context, INPUT.keys['SHIFT']);
  if (INPUT.keysPress['BACKSPACE']) EDIT.DRAW_SECTOR.popPoint();
  if (INPUT.keysPress['[']) context.incGridSize();
  if (INPUT.keysPress[']']) context.decGridSize();
  if (INPUT.keysPress['J']) EDIT.JOIN_SECTORS.join(hit, context);
  if (INPUT.keysPress['V']) setTexture();
  if (INPUT.keysPress['P']) sendToSelected(EDIT.TOGGLE_PARALLAX);
  if (INPUT.keysPress['UP']) sendPanRepeat(0, 1);
  if (INPUT.keysPress['DOWN']) sendPanRepeat(0, -1);
  if (INPUT.keysPress['LEFT']) sendPanRepeat(-1, 0);
  if (INPUT.keysPress['RIGHT']) sendPanRepeat(1, 0);
  if (INPUT.keysPress['O']) sendToSelected(EDIT.PALETTE);
  if (INPUT.keysPress['F']) sendToSelected(EDIT.FLIP);
  if (INPUT.keysPress['L']) insertSprite();
  if (INPUT.keysPress['R']) sendToSelected(EDIT.SPRITE_MODE);
  if (INPUT.keys['W']) ctr.moveForward(dt * 8000);
  if (INPUT.keys['S']) ctr.moveForward(-dt * 8000);
  if (INPUT.keys['A']) ctr.moveSideway(-dt * 8000);
  if (INPUT.keys['D']) ctr.moveSideway(dt * 8000);
  if (INPUT.wheel != 0) sendShadeChange(INPUT.wheel);
  ctr.track(INPUT.mouseX, INPUT.mouseY, INPUT.mouseButtons[2]);
}