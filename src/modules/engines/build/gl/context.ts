import * as GLM from '../../../../libs_js/glmatrix';
import * as BGL from './buildgl';
import { Board } from '../structs';
import { HitType, isSector, isWall } from '../utils';
import { Solid, wrapInGrid } from './renderable';
import { ArtProvider } from './cache';
import { walllen } from '../boardutils';
import { BuildContext } from '../buildedit';
import { Cache } from './cache';
import { PvsBoardVisitorResult } from '../boardvisitor';

let tmp = GLM.vec4.create();
let texMat = GLM.mat4.create();
function gridMatrix(board: Board, id: number, type: HitType): GLM.Mat4Array {
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

function drawGrid(gl: WebGLRenderingContext, cache: Cache, board: Board, id: number, addId: number, type: HitType) {
  let r = <Solid>cache.getByIdType(id, addId, type);
  BGL.draw(gl, wrapInGrid(r, gridMatrix(board, id, type)));
}

function drawEdges(gl: WebGLRenderingContext, cache: Cache, board: Board, id: number, addId: number, type: HitType) {
  BGL.draw(gl, cache.getByIdType(id, addId, type, true));
  if (isSector(type)) {
    let sec = board.sectors[id];
    let start = sec.wallptr;
    let end = sec.wallptr + sec.wallnum;
    for (let w = start; w < end; w++) {
      BGL.draw(gl, cache.getWallPoint(w, 32, type == HitType.CEILING));
    }
  } else if (isWall(type)) {
    let wall = board.walls[id];
    BGL.draw(gl, cache.getWallPoint(id, 32, false));
    BGL.draw(gl, cache.getWallPoint(id, 32, true));
    BGL.draw(gl, cache.getWallPoint(wall.point2, 32, false));
    BGL.draw(gl, cache.getWallPoint(wall.point2, 32, true));
  }
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

  invalidateAll() {
    this.cache.invalidateAll();
    this.pvs.reset();
  }

  highlightSector(gl: WebGLRenderingContext, board: Board, sectorId: number) {
    drawGrid(gl, this.cache, board, sectorId, -1, HitType.CEILING);
    drawGrid(gl, this.cache, board, sectorId, -1, HitType.FLOOR);
    drawEdges(gl, this.cache, board, sectorId, -1, HitType.CEILING);
    drawEdges(gl, this.cache, board, sectorId, -1, HitType.FLOOR);
  }

  highlightWall(gl: WebGLRenderingContext, board: Board, wallId: number, sectorId: number) {
    drawGrid(gl, this.cache, board, wallId, sectorId, HitType.UPPER_WALL);
    drawGrid(gl, this.cache, board, wallId, sectorId, HitType.MID_WALL);
    drawGrid(gl, this.cache, board, wallId, sectorId, HitType.LOWER_WALL);
    drawEdges(gl, this.cache, board, wallId, sectorId, HitType.UPPER_WALL);
    drawEdges(gl, this.cache, board, wallId, sectorId, HitType.MID_WALL);
    drawEdges(gl, this.cache, board, wallId, sectorId, HitType.LOWER_WALL);
  }

  highlightSprite(gl: WebGLRenderingContext, board: Board, spriteId: number) {
    drawEdges(gl, this.cache, board, spriteId, -1, HitType.SPRITE);
  }

  highlight(gl: WebGLRenderingContext, board: Board, id: number, addId: number, type: HitType) {
    drawGrid(gl, this.cache, board, id, addId, type);
    drawEdges(gl, this.cache, board, id, addId, type);
  }
}