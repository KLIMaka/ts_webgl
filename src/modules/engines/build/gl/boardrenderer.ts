import { loadImage } from '../../../../libs/imgutils';
import * as MU from '../../../../libs/mathutils';
import * as VEC from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import { Controller3D } from '../../../../modules/controller3d';
import * as PROFILE from '../../../../modules/profiler';
import { Deck } from '../../../deck';
import { Texture } from '../../../drawstruct';
import * as INPUT from '../../../input';
import * as TEX from '../../../textures';
import * as BU from '../boardutils';
import * as VIS from '../boardvisitor';
import * as EDIT from "../edit/edit";
import { snap } from '../edit/editutils';
import { hitscan, Hitscan, isSector, isWall, SubType } from '../hitscan';
import { Message, MessageHandlerList } from '../messages';
import { Board } from '../structs';
import * as U from '../utils';
import * as BGL from './buildgl';
import { ArtProvider, Cache } from './cache';
import { Context } from './context';
import { Renderable } from './renderable';

export type PicNumCallback = (picnum: number) => void;
export type PicNumSelector = (cb: PicNumCallback) => void;

export interface PalProvider extends ArtProvider {
  getPalTexture(): Texture;
  getPluTexture(): Texture;
  getPalswaps(): number;
  getShadowSteps(): number;
}

export class RorLink {
  constructor(public srcSpriteId: number, public dstSpriteId: number) { }
}

export class RorLinks {
  public ceilLinks: { [index: number]: RorLink } = {};
  public floorLinks: { [index: number]: RorLink } = {};

  public hasRor(sectorId: number) {
    return this.ceilLinks[sectorId] != undefined || this.floorLinks[sectorId] != undefined;
  }
}

export interface Implementation {
  rorLinks(): RorLinks;
  isMirrorPic(picnum: number): boolean;
}

function loadGridTexture(gl: WebGLRenderingContext, cb: (gridTex: Texture) => void): void {
  loadImage('resources/grid.png', (w: number, h: number, img: Uint8Array) => {
    cb(TEX.createTexture(w, h, gl, { filter: gl.NEAREST_MIPMAP_NEAREST, repeat: gl.REPEAT, aniso: true }, img, gl.RGBA));
  });
}

let context: Context;
let selection = new MessageHandlerList();
let hit = new Hitscan();
let picnumSelector: PicNumSelector;

let implementation: Implementation;
let cache: Cache;
let visible = new VIS.PvsBoardVisitorResult();

export function init(gl: WebGLRenderingContext, art: PalProvider, impl: Implementation, board: Board, selector: PicNumSelector, cb: () => void) {
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  context = new Context();
  context.cache = cache = new Cache();
  context.pvs = visible;
  context.board = board;
  context.art = art;
  implementation = impl;
  picnumSelector = selector;
  loadGridTexture(gl, (gridTex: Texture) =>
    BGL.init(gl, art.getPalTexture(), art.getPluTexture(), art.getPalswaps(), art.getShadowSteps(), gridTex, cb));
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

function print(board: Board, id: number, type: SubType) {
  if (INPUT.mouseClicks[0]) {
    switch (type) {
      case SubType.CEILING:
      case SubType.FLOOR:
        console.log(id, board.sectors[id]);
        break;
      case SubType.UPPER_WALL:
      case SubType.MID_WALL:
      case SubType.LOWER_WALL:
        console.log(id, board.walls[id]);
        break;
      case SubType.SPRITE:
        console.log(id, board.sprites[id]);
        break;
    }
  }
}

function pointerHitscan(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  PROFILE.startProfile('hitscan');
  let [vx, vz, vy] = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  hitscan(board, context.art, ms.x, ms.y, ms.z, ms.sec, vx, vy, vz, hit, 0);
  PROFILE.endProfile();
}

function move(gl: WebGLRenderingContext, board: Board, ctr: Controller3D) {
  if (selection.isEmpty())
    return;

  let fwd = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  let pos = ctr.getCamera().getPosition();
  EDIT.MOVE.handle.update(pos, fwd, INPUT.keys['SHIFT'], INPUT.keys['ALT'], INPUT.keys['CTRL'], hit, board);

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

function updateCursor(board: Board) {
  EDIT.SPLIT_WALL.deactivate();
  EDIT.DRAW_SECTOR.update(board, hit, context);
  if (hit.t != -1) {
    let [x, y] = snap(hit, context);
    BGL.setCursorPosiotion(x, hit.z / U.ZSCALE, y);
    if (isWall(hit.type)) EDIT.SPLIT_WALL.update(x, y, hit.id);
  }
}

function select(board: Board) {
  if (EDIT.MOVE.handle.isActive())
    return;

  selection.clear();
  let list = EDIT.getFromHitscan(board, hit, context, INPUT.keys['TAB']);
  for (let i = 0; i < list.length(); i++) {
    selection.add(list.get(i));
  }

  print(board, hit.id, hit.type);
}

function updateContext(gl: WebGLRenderingContext, board: Board) {
  context.board = board;
  context.gl = gl;
}

export function draw(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D, dt: number) {
  if (!U.inSector(board, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board, ms.x, ms.y, ms.sec);
  }

  BGL.newFrame(gl);
  drawGeometry(gl, board, ms, ctr);
  drawHelpers(gl, board);

  updateContext(gl, board);
  pointerHitscan(gl, board, ms, ctr);
  move(gl, board, ctr);
  select(board)
  updateCursor(board);

  if (INPUT.keys['CTRL'] && INPUT.mouseClicks[0]) EDIT.SPLIT_WALL.run(context);
  if (INPUT.keysPress['SPACE']) EDIT.DRAW_SECTOR.insertPoint(context);
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

function drawHelpers(gl: WebGLRenderingContext, board: Board) {
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  sendToSelected(EDIT.HIGHLIGHT);
  BGL.draw(gl, EDIT.DRAW_SECTOR.getRenderable());
  gl.disable(gl.BLEND);
  gl.enable(gl.DEPTH_TEST);
}

function writeStencilOnly(gl: WebGLRenderingContext, value: number) {
  gl.stencilFunc(gl.ALWAYS, value, 0xff);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
  gl.stencilMask(0xff);
  gl.depthMask(false);
  gl.colorMask(false, false, false, false);
}

function writeStenciledOnly(gl: WebGLRenderingContext, value: number) {
  gl.stencilFunc(gl.EQUAL, value, 0xff);
  gl.stencilMask(0x0);
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

function writeDepthOnly(gl: WebGLRenderingContext) {
  gl.colorMask(false, false, false, false);
}

function writeAll(gl: WebGLRenderingContext) {
  gl.depthMask(true);
  gl.colorMask(true, true, true, true);
}

let all = new VIS.AllBoardVisitorResult();
function drawGeometry(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  PROFILE.startProfile('processing');
  let result = ms.sec == -1
    ? all.visit(board)
    : visible.visit(board, ms, ctr.getCamera().forward());
  PROFILE.endProfile();

  BGL.setProjectionMatrix(ctr.getProjectionMatrix(gl));
  drawMirrors(gl, board, result, ms, ctr);
  drawRor(gl, board, result, ms, ctr);

  BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
  BGL.setPosition(ctr.getCamera().getPosition());
  drawRooms(gl, board, result);
}

let rorViss = new Map<RorLink, VIS.PvsBoardVisitorResult>();
function getLinkVis(link: RorLink) {
  let vis = rorViss.get(link);
  if (vis == undefined) {
    vis = new VIS.PvsBoardVisitorResult();
    rorViss.set(link, vis);
  }
  return vis;
}

let diff = GLM.vec3.create();
let stackTransform = GLM.mat4.create();
let mstmp = new U.MoveStruct();
let srcPos = GLM.vec3.create();
let dstPos = GLM.vec3.create();
let npos = GLM.vec3.create();

function drawStack(gl: WebGLRenderingContext, board: Board, ctr: Controller3D, link: RorLink, surface: Renderable, stencilValue: number) {
  if (!link)
    return;

  BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
  BGL.setPosition(ctr.getCamera().getPosition());
  writeStencilOnly(gl, stencilValue);
  BGL.draw(gl, surface);

  let src = board.sprites[link.srcSpriteId];
  let dst = board.sprites[link.dstSpriteId];
  GLM.vec3.set(srcPos, src.x, src.z / U.ZSCALE, src.y);
  GLM.vec3.set(dstPos, dst.x, dst.z / U.ZSCALE, dst.y);
  GLM.vec3.sub(diff, srcPos, dstPos);
  GLM.mat4.copy(stackTransform, ctr.getCamera().getTransformMatrix());
  GLM.mat4.translate(stackTransform, stackTransform, diff);
  GLM.vec3.sub(npos, ctr.getCamera().getPosition(), diff);

  mstmp.sec = dst.sectnum; mstmp.x = npos[0]; mstmp.y = npos[2]; mstmp.z = npos[1] * U.ZSCALE;
  BGL.setViewMatrix(stackTransform);
  BGL.setPosition(npos);
  writeStenciledOnly(gl, stencilValue);
  drawRooms(gl, board, getLinkVis(link).visit(board, mstmp, ctr.getCamera().forward()));

  BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
  BGL.setPosition(ctr.getCamera().getPosition());
  writeDepthOnly(gl);
  BGL.draw(gl, surface);
}

let rorSectorCollector = VIS.createSectorCollector((board: Board, sectorId: number) => implementation.rorLinks().hasRor(sectorId));

function drawRor(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forSector(board, rorSectorCollector.visit());
  PROFILE.get(null).inc('rors', rorSectorCollector.sectors.length());

  gl.enable(gl.STENCIL_TEST);
  for (let i = 0; i < rorSectorCollector.sectors.length(); i++) {
    let s = rorSectorCollector.sectors.get(i);
    let r = cache.sectors.get(s, context);
    drawStack(gl, board, ctr, implementation.rorLinks().ceilLinks[s], r.ceiling, i + 1);
    drawStack(gl, board, ctr, implementation.rorLinks().floorLinks[s], r.floor, i + 1);
  }
  gl.disable(gl.STENCIL_TEST);
  writeAll(gl);
}

let mirrorWallsCollector = VIS.createWallCollector((board: Board, wallId: number, sectorId: number) => implementation.isMirrorPic(board.walls[wallId].picnum));
let mirrorVis = new VIS.PvsBoardVisitorResult();
let wallNormal = GLM.vec2.create();
let mirrorNormal = GLM.vec3.create();
let mirroredTransform = GLM.mat4.create();
let mpos = GLM.vec3.create();

function drawMirrors(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forWall(board, mirrorWallsCollector.visit());
  PROFILE.get(null).inc('mirrors', mirrorWallsCollector.walls.length());
  gl.enable(gl.STENCIL_TEST);
  for (let i = 0; i < mirrorWallsCollector.walls.length(); i++) {
    let w = BU.unpackWallId(mirrorWallsCollector.walls.get(i));
    if (!U.wallVisible(board, w, ms))
      continue;

    // draw mirror surface into stencil
    let r = cache.walls.get(w, context);
    BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
    BGL.setPosition(ctr.getCamera().getPosition());
    writeStencilOnly(gl, i + 127);
    BGL.draw(gl, r);

    // draw reflections in stenciled area
    let w1 = board.walls[w]; let w2 = board.walls[w1.point2];
    GLM.vec2.set(wallNormal, w2.x - w1.x, w2.y - w1.y);
    VEC.normal2d(wallNormal, wallNormal);
    GLM.vec3.set(mirrorNormal, wallNormal[0], 0, wallNormal[1]);
    let mirrorrD = -MU.dot2d(wallNormal[0], wallNormal[1], w1.x, w1.y);
    VEC.mirrorBasis(mirroredTransform, ctr.getCamera().getTransformMatrix(), ctr.getCamera().getPosition(), mirrorNormal, mirrorrD);

    BGL.setViewMatrix(mirroredTransform);
    BGL.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
    gl.cullFace(gl.FRONT);
    GLM.vec3.set(mpos, ms.x, ms.z, ms.y);
    VEC.reflectPoint3d(mpos, mirrorNormal, mirrorrD, mpos);
    mstmp.sec = ms.sec; mstmp.x = mpos[0]; mstmp.y = mpos[2]; mstmp.z = mpos[1];
    writeStenciledOnly(gl, i + 127);
    drawRooms(gl, board, mirrorVis.visit(board, mstmp, ctr.getCamera().forward()));
    gl.cullFace(gl.BACK);

    // seal reflections by writing depth of mirror surface
    BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
    writeDepthOnly(gl);
    BGL.setClipPlane(0, 0, 0, 0);
    BGL.draw(gl, r);
  }
  gl.disable(gl.STENCIL_TEST);
  writeAll(gl);
}

function drawArray(gl: WebGLRenderingContext, arr: Deck<Renderable>) {
  for (let i = 0; i < arr.length(); i++) {
    BGL.draw(gl, arr.get(i));
  }
}

let surfaces = new Deck<Renderable>();
let surfacesTrans = new Deck<Renderable>();
let sprites = new Deck<Renderable>();
let spritesTrans = new Deck<Renderable>();

function clearDrawLists() {
  surfaces.clear();
  surfacesTrans.clear();
  sprites.clear();
  spritesTrans.clear();
}

function sectorVisitor(board: Board, sectorId: number) {
  let sector = cache.sectors.get(sectorId, context);
  if (implementation.rorLinks().floorLinks[sectorId] == undefined)
    surfaces.push(sector.floor);
  if (implementation.rorLinks().ceilLinks[sectorId] == undefined)
    surfaces.push(sector.ceiling);
  surfaces.push(sector);
  PROFILE.incCount('sectors');
}

function wallVisitor(board: Board, wallId: number, sectorId: number) {
  if (implementation.isMirrorPic(board.walls[wallId].picnum)) return;
  let wall = cache.walls.get(wallId, context);
  if (wall.mid.trans != 1) {
    surfacesTrans.push(wall.mid);
    surfaces.push(wall.bot);
    surfaces.push(wall.top);
  } else {
    surfaces.push(wall);
  }
  PROFILE.incCount('walls');
}

function spriteVisitor(board: Board, spriteId: number) {
  let sprite = cache.sprites.get(spriteId, context);
  let trans = sprite.trans != 1;
  (trans ? spritesTrans : sprites).push(sprite);
  PROFILE.incCount('sprites');
}

function drawRooms(gl: WebGLRenderingContext, board: Board, result: VIS.Result) {
  PROFILE.startProfile('processing');
  clearDrawLists();
  result.forSector(board, sectorVisitor);
  result.forWall(board, wallVisitor);
  result.forSprite(board, spriteVisitor);
  PROFILE.endProfile();

  PROFILE.startProfile('draw');
  drawArray(gl, surfaces);

  gl.polygonOffset(-1, -8);
  drawArray(gl, sprites);
  gl.polygonOffset(0, 0);

  gl.enable(gl.BLEND);
  drawArray(gl, surfacesTrans);

  gl.polygonOffset(-1, -8);
  drawArray(gl, spritesTrans);
  gl.polygonOffset(0, 0);
  gl.disable(gl.BLEND);
  PROFILE.endProfile();
}