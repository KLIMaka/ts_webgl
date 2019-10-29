import { ViewPoint, BuildContext } from '../api';
import { BuildRenderableProvider, Renderable } from './renderable';
import { TopDownBoardVisitorResult, VisResult } from '../boardvisitor';
import * as PROFILE from '../../../profiler';
import * as BGL from './buildgl';
import { Deck } from '../../../collections';
import { Board } from '../structs';

let context: BuildContext;
export function init(ctx: BuildContext) {
  context = ctx;

  let gl = ctx.gl;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

let visible = new TopDownBoardVisitorResult();
export function draw(renderables: BuildRenderableProvider, view: ViewPoint, dist: number) {
  PROFILE.startProfile('processing');
  let result = visible.visit(context.board, view, dist);
  PROFILE.endProfile();

  BGL.setProjectionMatrix(view.getProjectionMatrix());
  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  drawRooms(renderables, result);
}

let renderables: BuildRenderableProvider;
let surfaces = new Deck<Renderable>();

function clearDrawLists() {
  surfaces.clear();
}

function sectorVisitor(board: Board, sectorId: number) {
  let sector = renderables.sector(sectorId);
  surfaces.push(sector);
  PROFILE.incCount('sectors');
}

function wallVisitor(board: Board, wallId: number, sectorId: number) {
  let wall = renderables.wall(wallId);
  surfaces.push(wall);
  PROFILE.incCount('walls');
}

function spriteVisitor(board: Board, spriteId: number) {
  let sprite = renderables.sprite(spriteId);
  surfaces.push(sprite);
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
  PROFILE.endProfile();
}