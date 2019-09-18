import { cyclic } from '../../../../libs/mathutils';
import * as GLM from '../../../../libs_js/glmatrix';
import { Deck } from '../../../deck';
import { walllen } from '../boardutils';
import { PvsBoardVisitorResult } from '../boardvisitor';
import { ArtProvider, BuildContext } from '../edit/editapi';
import { isSector, isSprite, isWall, SubType } from '../hitscan';
import { Board } from '../structs';
import * as BGL from './buildgl';
import { Cache } from './cache';
import { Solid } from './renderable';

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

function drawGrid(gl: WebGLRenderingContext, cache: Cache, ctx: BuildContext, id: number, type: SubType) {
  let r = <Solid>cache.getByIdType(ctx, id, type);
  BGL.draw(gl, wrapInGrid(r, gridMatrix(ctx.board, id, type)));
}

let points = new Deck<any>();
function drawEdges(gl: WebGLRenderingContext, cache: Cache, ctx: BuildContext, id: number, type: SubType) {
  points.clear();
  if (isSector(type)) {
    let sec = ctx.board.sectors[id];
    let start = sec.wallptr;
    let end = sec.wallptr + sec.wallnum;
    for (let w = start; w < end; w++) {
      points.push(type == SubType.CEILING
        ? cache.wallCeilPoints.get(w, ctx)
        : cache.wallFloorPoints.get(w, ctx));
    }
    points.push(type == SubType.CEILING
      ? cache.sectorCeilingHinge.get(id, ctx)
      : cache.sectorFloorHinge.get(id, ctx));
  } else if (isWall(type)) {
    let wall = ctx.board.walls[id];
    points.push(cache.wallCeilPoints.get(id, ctx));
    points.push(cache.wallCeilPoints.get(id, ctx));
    points.push(cache.wallFloorPoints.get(wall.point2, ctx));
    points.push(cache.wallFloorPoints.get(wall.point2, ctx));
  } else if (isSprite(type)) {
    points.push(cache.spritesAngWireframe.get(id, ctx));
  }
  BGL.draw(gl, cache.getByIdType(ctx, id, type, true));
  for (let i = 0; i < points.length(); i++)
    BGL.draw(gl, points.get(i));
}

function drawWallPoints(gl: WebGLRenderingContext, cache: Cache, ctx: BuildContext, wallId: number) {
  points.clear();
  points.push(cache.wallCeilPoints.get(wallId, ctx));
  points.push(cache.wallFloorPoints.get(wallId, ctx));
  points.push(cache.wallLines.get(wallId, ctx));
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

  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;

  snapScale() {
    return this.gridSizes[this.gridSizeIdx];
  }

  incGridSize() {
    this.gridSizeIdx = cyclic(this.gridSizeIdx + 1, this.gridSizes.length);
  }

  decGridSize() {
    this.gridSizeIdx = cyclic(this.gridSizeIdx - 1, this.gridSizes.length);
  }

  snap(x: number) {
    return snapGrid(x, this.snapScale());
  }

  scaledSnap(x: number, scale: number) {
    return snapGrid(x, this.gridSizes[this.gridSizeIdx] * scale);
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

  highlightSector(sectorId: number) {
    drawGrid(this.gl, this.cache, this, sectorId, SubType.CEILING);
    drawGrid(this.gl, this.cache, this, sectorId, SubType.FLOOR);
    drawEdges(this.gl, this.cache, this, sectorId, SubType.CEILING);
    drawEdges(this.gl, this.cache, this, sectorId, SubType.FLOOR);
  }

  highlightWallSegment(wallId: number) {
    drawGrid(this.gl, this.cache, this, wallId, SubType.UPPER_WALL);
    drawGrid(this.gl, this.cache, this, wallId, SubType.MID_WALL);
    drawGrid(this.gl, this.cache, this, wallId, SubType.LOWER_WALL);
    drawEdges(this.gl, this.cache, this, wallId, SubType.UPPER_WALL);
    drawEdges(this.gl, this.cache, this, wallId, SubType.MID_WALL);
    drawEdges(this.gl, this.cache, this, wallId, SubType.LOWER_WALL);
  }

  highlightWall(wallId: number) {
    drawWallPoints(this.gl, this.cache, this, wallId);
  }

  highlightSprite(spriteId: number) {
    drawEdges(this.gl, this.cache, this, spriteId, SubType.SPRITE);
  }

  highlight(id: number, type: SubType) {
    drawGrid(this.gl, this.cache, this, id, type);
    drawEdges(this.gl, this.cache, this, id, type);
  }
}