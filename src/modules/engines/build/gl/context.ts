import * as GLM from '../../../../libs_js/glmatrix';
import * as BGL from './buildgl';
import { Board } from '../structs';
import { Solid, wrapInGrid } from './renderable';
import { ArtProvider } from './cache';
import { walllen } from '../boardutils';
import { BuildContext } from '../boardedit';
import { Cache } from './cache';
import { PvsBoardVisitorResult } from '../boardvisitor';
import { Deck } from '../../../deck';
import { isSector, SubType, isWall } from '../hitscan';

let tmp = GLM.vec4.create();
let texMat = GLM.mat4.create();
function gridMatrix(board: Board, id: number, type: SubType): GLM.Mat4Array {
  GLM.mat4.identity(texMat);
  if (isSector(type)) {
    GLM.vec4.set(tmp, 1 / 512, 1 / 512, 1, 1);
    GLM.mat4.scale(texMat, texMat, tmp);
    GLM.mat4.rotateX(texMat, texMat, Math.PI / 2);
  } else if (isWall(type)) {
    let wall1 = board.walls[id];
    let wall2 = board.walls[wall1.point2];
    let dx = wall2.x - wall1.x;
    let dy = wall2.y - wall1.y;
    let d = 128 / (walllen(board, id) / wall1.xrepeat);
    GLM.vec4.set(tmp, d / 512, 1 / 512, 1, 1);
    GLM.mat4.scale(texMat, texMat, tmp);
    GLM.mat4.rotateY(texMat, texMat, -Math.atan2(-dy, dx));
    GLM.vec4.set(tmp, -wall1.x, 0, -wall1.y, 0);
    GLM.mat4.translate(texMat, texMat, tmp);
  }
  return texMat;
}

function drawGrid(gl: WebGLRenderingContext, cache: Cache, board: Board, id: number, addId: number, type: SubType) {
  let r = <Solid>cache.getByIdType(id, addId, type);
  BGL.draw(gl, wrapInGrid(r, gridMatrix(board, id, type)));
}

let points = new Deck<any>();
function drawEdges(gl: WebGLRenderingContext, cache: Cache, board: Board, id: number, addId: number, type: SubType) {
  points.clear();
  if (isSector(type)) {
    let sec = board.sectors[id];
    let start = sec.wallptr;
    let end = sec.wallptr + sec.wallnum;
    for (let w = start; w < end; w++) {
      points.push(cache.getWallPoint(w, 32, type == SubType.CEILING));
    }
  } else if (isWall(type)) {
    let wall = board.walls[id];
    points.push(cache.getWallPoint(id, 32, false));
    points.push(cache.getWallPoint(id, 32, true));
    points.push(cache.getWallPoint(wall.point2, 32, false));
    points.push(cache.getWallPoint(wall.point2, 32, true));
  }
  BGL.draw(gl, cache.getByIdType(id, addId, type, true));
  for (let i = 0; i < points.length(); i++)
    BGL.draw(gl, points.get(i));
}

function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

export class Context implements BuildContext {
  art: ArtProvider = null;
  board: Board = null;
  gl: WebGLRenderingContext = null;

  cache: Cache = null;
  pvs: PvsBoardVisitorResult = null;
  gridSize = 128;

  snap(x: number) {
    return snapGrid(x, this.gridSize);
  }

  scaledSnap(x: number, scale: number) {
    return snapGrid(x, this.gridSize * scale);
  }

  invalidateAll() {
    this.cache.invalidateAll();
    this.pvs.reset();
  }

  invalidateSector(id: number) {
    this.cache.invalidateSector(id);
    this.pvs.reset();
  }

  invalidateWall(id: number) {
    this.cache.invalidateWall(id);
    this.pvs.reset();
  }

  invalidateSprite(id: number) {
    this.cache.invalidateSprite(id);
    this.pvs.reset();
  }

  highlightSector(gl: WebGLRenderingContext, board: Board, sectorId: number) {
    drawGrid(gl, this.cache, board, sectorId, -1, SubType.CEILING);
    drawGrid(gl, this.cache, board, sectorId, -1, SubType.FLOOR);
    drawEdges(gl, this.cache, board, sectorId, -1, SubType.CEILING);
    drawEdges(gl, this.cache, board, sectorId, -1, SubType.FLOOR);
  }

  highlightWall(gl: WebGLRenderingContext, board: Board, wallId: number, sectorId: number) {
    drawGrid(gl, this.cache, board, wallId, sectorId, SubType.UPPER_WALL);
    drawGrid(gl, this.cache, board, wallId, sectorId, SubType.MID_WALL);
    drawGrid(gl, this.cache, board, wallId, sectorId, SubType.LOWER_WALL);
    drawEdges(gl, this.cache, board, wallId, sectorId, SubType.UPPER_WALL);
    drawEdges(gl, this.cache, board, wallId, sectorId, SubType.MID_WALL);
    drawEdges(gl, this.cache, board, wallId, sectorId, SubType.LOWER_WALL);
  }

  highlightSprite(gl: WebGLRenderingContext, board: Board, spriteId: number) {
    drawEdges(gl, this.cache, board, spriteId, -1, SubType.SPRITE);
  }

  highlight(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: SubType) {
    drawGrid(gl, this.cache, board, id, addId, type);
    drawEdges(gl, this.cache, board, id, addId, type);
  }
}