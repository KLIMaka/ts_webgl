import * as GLM from '../../../../libs_js/glmatrix';
import { Deck } from '../../../collections';
import * as PROFILE from '../../../profiler';
import { BuildContext } from '../api';
import { TopDownBoardVisitorResult, VisResult } from '../boardvisitor';
import { Board } from '../structs';
import { View2d } from '../view';
import * as BGL from './buildgl';
import { BuildRenderableProvider, Renderable } from './renderable';

let context: BuildContext;
export function init(gl: WebGLRenderingContext, ctx: BuildContext) {
  context = ctx;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

let visible = new TopDownBoardVisitorResult();
export function draw(view: View2d, campos: GLM.Vec3Array, dist: number) {
  PROFILE.startProfile('processing');
  let result = visible.visit(context.board, campos, dist);
  PROFILE.endProfile();

  BGL.setProjectionMatrix(view.getProjectionMatrix());
  BGL.setViewMatrix(view.getTransformMatrix());
  BGL.setPosition(view.getPosition());
  drawRooms(view, result);
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

function drawRooms(view: View2d, result: VisResult) {
  PROFILE.startProfile('processing');
  renderables = view.renderables;
  clearDrawLists();
  result.forSector(context.board, sectorVisitor);
  result.forWall(context.board, wallVisitor);
  result.forSprite(context.board, spriteVisitor);
  PROFILE.endProfile();

  PROFILE.startProfile('draw');
  BGL.drawAll(context, view.gl, surfaces);
  PROFILE.endProfile();
}