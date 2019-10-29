import { dot2d } from '../../../../libs/mathutils';
import { mirrorBasis, normal2d, reflectPoint3d } from '../../../../libs/vecmath';
import * as GLM from '../../../../libs_js/glmatrix';
import * as PROFILE from '../../../profiler';
import { Deck } from '../../../collections';
import { BuildContext, ViewPoint } from '../api';
import { unpackWallId } from '../boardutils';
import { AllBoardVisitorResult, createSectorCollector, createWallCollector, PvsBoardVisitorResult, VisResult } from '../boardvisitor';
import { Board } from '../structs';
import { wallVisible, ZSCALE } from '../utils';
import * as BGL from './buildgl';
import { BuildRenderableProvider, Renderable } from './renderable';

export class RorLink {
  constructor(readonly srcSpriteId: number, readonly dstSpriteId: number) { }
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

let implementation: Implementation;
let context: BuildContext;

export function init(ctx: BuildContext, impl: Implementation) {
  context = ctx;
  implementation = impl;

  let gl = ctx.gl;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

export function draw(renderables: BuildRenderableProvider, view: ViewPoint) {
  drawGeometry(renderables, view);
}

function writeStencilOnly(value: number) {
  context.gl.stencilFunc(WebGLRenderingContext.ALWAYS, value, 0xff);
  context.gl.stencilOp(WebGLRenderingContext.KEEP, WebGLRenderingContext.KEEP, WebGLRenderingContext.REPLACE);
  context.gl.stencilMask(0xff);
  context.gl.depthMask(false);
  context.gl.colorMask(false, false, false, false);
}

function writeStenciledOnly(value: number) {
  context.gl.stencilFunc(WebGLRenderingContext.EQUAL, value, 0xff);
  context.gl.stencilMask(0x0);
  context.gl.depthMask(true);
  context.gl.colorMask(true, true, true, true);
}

function writeDepthOnly() {
  context.gl.colorMask(false, false, false, false);
}

function writeAll() {
  context.gl.depthMask(true);
  context.gl.colorMask(true, true, true, true);
}

let visible = new PvsBoardVisitorResult();
let all = new AllBoardVisitorResult();
function drawGeometry(renderables: BuildRenderableProvider, view: ViewPoint) {
  PROFILE.startProfile('processing');
  let result = view.sec == -1
    ? all.visit(context.board)
    : visible.visit(context.board, view, view.getForward());
  PROFILE.endProfile();

  BGL.setProjectionMatrix(view.getProjectionMatrix());
  drawMirrors(renderables, result, view);
  drawRor(renderables, result, view);

  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  drawRooms(renderables, result);
}

let rorViss = new Map<RorLink, PvsBoardVisitorResult>();
function getLinkVis(link: RorLink) {
  let vis = rorViss.get(link);
  if (vis == undefined) {
    vis = new PvsBoardVisitorResult();
    rorViss.set(link, vis);
  }
  return vis;
}

let diff = GLM.vec3.create();
let stackTransform = GLM.mat4.create();
let srcPos = GLM.vec3.create();
let dstPos = GLM.vec3.create();
let npos = GLM.vec3.create();
let mstmp = { sec: 0, x: 0, y: 0, z: 0 };

function drawStack(renderables: BuildRenderableProvider, view: ViewPoint, link: RorLink, surface: Renderable, stencilValue: number) {
  if (!link) return;

  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  writeStencilOnly(stencilValue);
  BGL.draw(context.gl, surface);

  let src = context.board.sprites[link.srcSpriteId];
  let dst = context.board.sprites[link.dstSpriteId];
  GLM.vec3.set(srcPos, src.x, src.z / ZSCALE, src.y);
  GLM.vec3.set(dstPos, dst.x, dst.z / ZSCALE, dst.y);
  GLM.vec3.sub(diff, srcPos, dstPos);
  GLM.mat4.copy(stackTransform, view.getTransformMatrix());
  GLM.mat4.translate(stackTransform, stackTransform, diff);
  GLM.vec3.sub(npos, view.getPosition(), diff);

  mstmp.sec = dst.sectnum; mstmp.x = npos[0]; mstmp.y = npos[2]; mstmp.z = npos[1] * ZSCALE;
  BGL.setViewMatrix(stackTransform);
  BGL.setPosition(npos);
  writeStenciledOnly(stencilValue);
  drawRooms(renderables, getLinkVis(link).visit(context.board, mstmp, view.getForward()));

  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  writeDepthOnly();
  BGL.draw(context.gl, surface);
}

let rorSectorCollector = createSectorCollector((board: Board, sectorId: number) => implementation.rorLinks().hasRor(sectorId));

function drawRor(renderables: BuildRenderableProvider, result: VisResult, view: ViewPoint) {
  result.forSector(context.board, rorSectorCollector.visit());
  PROFILE.get(null).inc('rors', rorSectorCollector.sectors.length());

  context.gl.enable(WebGLRenderingContext.STENCIL_TEST);
  for (let i = 0; i < rorSectorCollector.sectors.length(); i++) {
    let s = rorSectorCollector.sectors.get(i);
    let r = renderables.sector(s);
    drawStack(renderables, view, implementation.rorLinks().ceilLinks[s], r.ceiling, i + 1);
    drawStack(renderables, view, implementation.rorLinks().floorLinks[s], r.floor, i + 1);
  }
  context.gl.disable(WebGLRenderingContext.STENCIL_TEST);
  writeAll();
}

let mirrorWallsCollector = createWallCollector((board: Board, wallId: number, sectorId: number) => implementation.isMirrorPic(board.walls[wallId].picnum));
let mirrorVis = new PvsBoardVisitorResult();
let wallNormal = GLM.vec2.create();
let mirrorNormal = GLM.vec3.create();
let mirroredTransform = GLM.mat4.create();
let mpos = GLM.vec3.create();

function drawMirrors(renderables: BuildRenderableProvider, result: VisResult, view: ViewPoint) {
  result.forWall(context.board, mirrorWallsCollector.visit());
  PROFILE.get(null).inc('mirrors', mirrorWallsCollector.walls.length());
  context.gl.enable(WebGLRenderingContext.STENCIL_TEST);
  for (let i = 0; i < mirrorWallsCollector.walls.length(); i++) {
    let w = unpackWallId(mirrorWallsCollector.walls.get(i));
    if (!wallVisible(context.board, w, view))
      continue;

    // draw mirror surface into stencil
    let r = renderables.wall(w);
    BGL.setViewMatrix(view.getTransformMatrix());
    BGL.setPosition(view.getPosition());
    writeStencilOnly(i + 127);
    BGL.draw(context.gl, r);

    // draw reflections in stenciled area
    let w1 = context.board.walls[w]; let w2 = context.board.walls[w1.point2];
    GLM.vec2.set(wallNormal, w2.x - w1.x, w2.y - w1.y);
    normal2d(wallNormal, wallNormal);
    GLM.vec3.set(mirrorNormal, wallNormal[0], 0, wallNormal[1]);
    let mirrorrD = -dot2d(wallNormal[0], wallNormal[1], w1.x, w1.y);
    mirrorBasis(mirroredTransform, view.getTransformMatrix(), view.getPosition(), mirrorNormal, mirrorrD);

    BGL.setViewMatrix(mirroredTransform);
    BGL.setClipPlane(mirrorNormal[0], mirrorNormal[1], mirrorNormal[2], mirrorrD);
    context.gl.cullFace(WebGLRenderingContext.FRONT);
    let [sx, sy, sz] = view.getPosition();
    GLM.vec3.set(mpos, sx, sy, sz);
    reflectPoint3d(mpos, mirrorNormal, mirrorrD, mpos);
    mstmp.sec = view.sec; mstmp.x = mpos[0]; mstmp.y = mpos[2]; mstmp.z = mpos[1];
    writeStenciledOnly(i + 127);
    drawRooms(renderables, mirrorVis.visit(context.board, mstmp, view.getForward()));
    context.gl.cullFace(WebGLRenderingContext.BACK);

    // seal reflections by writing depth of mirror surface
    BGL.setViewMatrix(view.getTransformMatrix());
    writeDepthOnly();
    BGL.setClipPlane(0, 0, 0, 0);
    BGL.draw(context.gl, r);
  }
  context.gl.disable(WebGLRenderingContext.STENCIL_TEST);
  writeAll();
}

let renderables: BuildRenderableProvider;
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
  let sector = renderables.sector(sectorId);
  if (implementation.rorLinks().floorLinks[sectorId] == undefined)
    surfaces.push(sector.floor);
  if (implementation.rorLinks().ceilLinks[sectorId] == undefined)
    surfaces.push(sector.ceiling);
  PROFILE.incCount('sectors');
}

function wallVisitor(board: Board, wallId: number, sectorId: number) {
  if (implementation.isMirrorPic(board.walls[wallId].picnum)) return;
  let wall = board.walls[wallId];
  let wallr = renderables.wall(wallId);
  if (wall.cstat.translucent || wall.cstat.translucentReversed) {
    surfacesTrans.push(wallr.mid);
    surfaces.push(wallr.bot);
    surfaces.push(wallr.top);
  } else {
    surfaces.push(wallr);
  }
  PROFILE.incCount('walls');
}

function spriteVisitor(board: Board, spriteId: number) {
  let spriter = renderables.sprite(spriteId);
  let sprite = board.sprites[spriteId];
  let trans = sprite.cstat.tranclucentReversed == 1 || sprite.cstat.translucent == 1;
  (trans ? spritesTrans : sprites).push(spriter);
  PROFILE.incCount('sprites');
}

function drawRooms(r: BuildRenderableProvider, result: VisResult) {
  PROFILE.startProfile('processing');
  renderables = r;
  clearDrawLists();
  result.forSector(context.board, sectorVisitor);
  result.forWall(context.board, wallVisitor);
  result.forSprite(context.board, spriteVisitor);
  PROFILE.endProfile();

  PROFILE.startProfile('draw');
  BGL.drawAll(context.gl, surfaces);

  context.gl.polygonOffset(-1, -8);
  BGL.drawAll(context.gl, sprites);
  context.gl.polygonOffset(0, 0);

  context.gl.enable(WebGLRenderingContext.BLEND);
  BGL.drawAll(context.gl, surfacesTrans);

  context.gl.polygonOffset(-1, -8);
  BGL.drawAll(context.gl, spritesTrans);
  context.gl.polygonOffset(0, 0);
  context.gl.disable(WebGLRenderingContext.BLEND);
  PROFILE.endProfile();
}