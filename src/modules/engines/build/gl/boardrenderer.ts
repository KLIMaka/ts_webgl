import { loadImage } from '../../../../libs/imgutils';
import { List } from '../../../../libs/list';
import * as MU from '../../../../libs/mathutils';
import * as VEC from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import { Controller3D } from '../../../../modules/controller3d';
import * as PROFILE from '../../../../modules/profiler';
import { Texture } from '../../../drawstruct';
import * as INPUT from '../../../input';
import * as TEX from '../../../textures';
import { ObjectVector } from '../../../vector';
import * as BLOOD from '../bloodutils';
import * as BU from '../boardutils';
import * as VIS from '../boardvisitor';
import * as EDIT from "../buildedit";
import { MessageHandler, sendMessage } from '../messages';
import { Board } from '../structs';
import * as U from '../utils';
import * as BUFF from './buffers';
import * as BGL from './buildgl';
import { ArtProvider, Cache } from './cache';
import { Context } from './context';
import { Renderable } from './renderable';

export interface PalProvider extends ArtProvider {
  getPalTexture(): Texture;
  getPluTexture(): Texture;
}

function loadGridTexture(gl: WebGLRenderingContext, cb: (gridTex: Texture) => void): void {
  loadImage('resources/grid.png', (w: number, h: number, img: Uint8Array) => {
    cb(TEX.createTexture(w, h, gl, { filter: gl.NEAREST_MIPMAP_NEAREST, repeat: gl.REPEAT, aniso: true }, img, gl.RGBA));
  });
}

let context: Context;
let artProvider: PalProvider;
let cache: Cache;
let rorLinks: BLOOD.RorLinks;
export function init(gl: WebGLRenderingContext, art: PalProvider, board: Board, cb: () => void) {
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.enable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

  context = new Context();
  artProvider = context.art = art;
  cache = context.cache = new Cache(board, art);
  rorLinks = BLOOD.loadRorLinks(board);
  loadGridTexture(gl, (gridTex: Texture) => BGL.init(gl, art.getPalTexture(), art.getPluTexture(), gridTex, cb));
}

let selection = new List<MessageHandler>();

function print(board: Board, id: number, type: U.HitType) {
  if (INPUT.mouseClicks[0]) {
    switch (type) {
      case U.HitType.CEILING:
      case U.HitType.FLOOR:
        console.log(id, board.sectors[id]);
        break;
      case U.HitType.UPPER_WALL:
      case U.HitType.MID_WALL:
      case U.HitType.LOWER_WALL:
        console.log(id, board.walls[id]);
        break;
      case U.HitType.SPRITE:
        console.log(id, board.sprites[id]);
        break;
    }
  }
}

let hit = new U.Hitscan();
function hitscan(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  let [vx, vz, vy] = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  U.hitscan(board, artProvider, ms.x, ms.y, ms.z, ms.sec, vx, vy, -vz, hit, 0);
}

function move(gl: WebGLRenderingContext, board: Board, ctr: Controller3D) {
  if (selection.isEmpty())
    return;

  if (!EDIT.MOVE.isActive() && INPUT.mouseButtons[0]) {
    EDIT.MOVE.start(hit.x, hit.z / U.ZSCALE, hit.y);
    sendMessage(EDIT.START_MOVE, context, selection);
  } else if (!INPUT.mouseButtons[0]) {
    EDIT.MOVE.stop();
    sendMessage(EDIT.END_MOVE, context, selection);
    return;
  }

  let fwd = ctr.getForwardUnprojected(gl, INPUT.mouseX, INPUT.mouseY);
  let pos = ctr.getCamera().getPosition();
  EDIT.MOVE.update(pos, fwd, INPUT.keys['ALT'], INPUT.keys['SHIFT'], hit, board);
  sendMessage(EDIT.MOVE, context, selection);
}

function snap(board: Board) {
  if (hit.t != -1) {
    let x = hit.x; let y = hit.y;
    if (U.isSector(hit.type)) {
      x = context.snap(x);
      y = context.snap(y);
    } else if (U.isWall(hit.type)) {
      let w = hit.id;
      let wall = board.walls[w];
      let w1 = BU.nextwall(board, w); let wall1 = board.walls[w1];
      let dx = wall1.x - wall.x;
      let dy = wall1.y - wall.y;
      let repeat = BU.DEFAULT_REPEAT_RATE * wall.xrepeat;
      let dxt = x - wall.x; let dyt = y - wall.y;
      let t = MU.len2d(dxt, dyt) / MU.len2d(dx, dy);
      t = context.snap(t * repeat) / repeat;
      x = MU.int(wall.x + (t * dx));
      y = MU.int(wall.y + (t * dy));
    }
    EDIT.SPLIT_WALL.x = x;
    EDIT.SPLIT_WALL.y = y;
    BGL.setCursorPosiotion(x, hit.z / U.ZSCALE, y);
  }
}

function select(board: Board) {
  if (EDIT.MOVE.isActive())
    return;

  selection.clear();
  let list = EDIT.getFromHitscan(board, hit);
  for (let i = 0; i < list.length(); i++) {
    selection.push(list.get(i));
  }
}

function updateContext(gl: WebGLRenderingContext, board: Board) {
  context.board = board;
  context.gl = gl;
}

export function draw(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  updateContext(gl, board);
  hitscan(gl, board, ms, ctr);
  move(gl, board, ctr);
  select(board)
  snap(board);

  if (INPUT.keys['INSERT']) {
    sendMessage(EDIT.SPLIT_WALL, context, selection);
  }

  BGL.newFrame(gl);
  drawImpl(gl, board, ms, ctr);
  drawHelpers(gl, board);
}

function drawHelpers(gl: WebGLRenderingContext, board: Board) {
  gl.disable(gl.DEPTH_TEST);
  // sendMessage(EDIT.HIGHLIGHT, context, selection);
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
let visible = new VIS.PvsBoardVisitorResult();
function drawImpl(gl: WebGLRenderingContext, board: Board, ms: U.MoveStruct, ctr: Controller3D) {
  if (!U.inSector(board, ms.x, ms.y, ms.sec)) {
    ms.sec = U.findSector(board, ms.x, ms.y, ms.sec);
  }

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

let additionVisible = new VIS.PvsBoardVisitorResult();
let diff = GLM.vec3.create();
let stackTransform = GLM.mat4.create();
let mstmp = new U.MoveStruct();
let srcPos = GLM.vec3.create();
let dstPos = GLM.vec3.create();
let npos = GLM.vec3.create();

function drawStack(gl: WebGLRenderingContext, board: Board, ctr: Controller3D, link: BLOOD.RorLink, surface: Renderable, stencilValue: number) {
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

  mstmp.sec = dst.sectnum; mstmp.x = npos[0]; mstmp.y = npos[2]; mstmp.z = npos[1];
  BGL.setViewMatrix(stackTransform);
  BGL.setPosition(npos);
  writeStenciledOnly(gl, stencilValue);
  drawRooms(gl, board, additionVisible.visit(board, mstmp, ctr.getCamera().forward()));

  BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
  BGL.setPosition(ctr.getCamera().getPosition());
  writeDepthOnly(gl);
  BGL.draw(gl, surface);
}

let rorSectorCollector = VIS.createSectorCollector((board: Board, sectorId: number) => rorLinks.hasRor(sectorId));
function drawRor(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forSector(rorSectorCollector.visit());

  gl.enable(gl.STENCIL_TEST);
  for (let i = 0; i < rorSectorCollector.sectors.length(); i++) {
    let s = rorSectorCollector.sectors.get(i);
    let r = cache.getSector(s);
    drawStack(gl, board, ctr, rorLinks.ceilLinks[s], r.ceiling, i + 1);
    drawStack(gl, board, ctr, rorLinks.floorLinks[s], r.floor, i + 1);
  }
  gl.disable(gl.STENCIL_TEST);
  writeAll(gl);
}

let mirrorWallsCollector = VIS.createWallCollector((board: Board, wallId: number, sectorId: number) => board.walls[wallId].picnum == BLOOD.MIRROR_PIC);
let msMirrored = new U.MoveStruct();
let wallNormal = GLM.vec2.create();
let mirrorNormal = GLM.vec3.create();
let mirroredTransform = GLM.mat4.create();
let mpos = GLM.vec3.create();

function drawMirrors(gl: WebGLRenderingContext, board: Board, result: VIS.Result, ms: U.MoveStruct, ctr: Controller3D) {
  result.forWall(mirrorWallsCollector.visit());

  gl.enable(gl.STENCIL_TEST);
  for (let i = 0; i < mirrorWallsCollector.walls.length(); i++) {
    let w = VIS.unpackWallId(mirrorWallsCollector.walls.get(i));
    if (!U.wallVisible(board, w, ms))
    continue;
    
    // draw mirror surface into stencil
    let r = cache.getWall(w, VIS.unpackSectorId(mirrorWallsCollector.walls.get(i)));
    BGL.setViewMatrix(ctr.getCamera().getTransformMatrix());
    BGL.setPosition(ctr.getCamera().getPosition());
    writeStencilOnly(gl, i + 127);
    BGL.draw(gl, r);
    
    // draw reflections in stenciled area
    let w1 = board.walls[w];
    let w2 = board.walls[w1.point2];
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
    msMirrored.sec = ms.sec; msMirrored.x = mpos[0]; msMirrored.y = mpos[2]; msMirrored.z = mpos[1];
    writeStenciledOnly(gl, i + 127);
    drawRooms(gl, board, additionVisible.visit(board, msMirrored, ctr.getCamera().forward()));
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

function drawArray(gl: WebGLRenderingContext, arr: ObjectVector<Renderable>) {
  for (let i = 0; i < arr.length(); i++) {
    BGL.draw(gl, arr.get(i));
  }
}

let surfaces = new ObjectVector<Renderable>();
let surfacesTrans = new ObjectVector<Renderable>();
let sprites = new ObjectVector<Renderable>();
let spritesTrans = new ObjectVector<Renderable>();

function clearDrawLists() {
  surfaces.clear();
  surfacesTrans.clear();
  sprites.clear();
  spritesTrans.clear();
}

function sectorVisitor(board: Board, sectorId: number) {
  let sector = cache.getSector(sectorId);
  if (rorLinks.floorLinks[sectorId] == undefined)
    surfaces.push(sector.floor);
  if (rorLinks.ceilLinks[sectorId] == undefined)
    surfaces.push(sector.ceiling);
  PROFILE.incCount('sectors');
}

function wallVisitor(board: Board, wallId: number, sectorId: number) {
  if (board.walls[wallId].picnum == BLOOD.MIRROR_PIC)
    return;
  let wall = cache.getWall(wallId, sectorId);
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
  let sprite = cache.getSprite(spriteId);
  let trans = sprite.trans != 1;
  (trans ? spritesTrans : sprites).push(sprite);
  PROFILE.incCount('sprites');
}

function drawRooms(gl: WebGLRenderingContext, board: Board, result: VIS.Result) {
  PROFILE.startProfile('processing');
  clearDrawLists();
  result.forSector(sectorVisitor);
  result.forWall(wallVisitor);
  result.forSprite(spriteVisitor);
  PROFILE.set('buffer', BUFF.getFreeSpace());
  PROFILE.endProfile();

  PROFILE.startProfile('draw');

  drawArray(gl, surfaces);

  gl.polygonOffset(-1, -8);
  drawArray(gl, sprites);
  gl.polygonOffset(0, 0);

  drawArray(gl, surfacesTrans);

  gl.polygonOffset(-1, -8);
  drawArray(gl, spritesTrans);
  gl.polygonOffset(0, 0);

  PROFILE.endProfile();
}