import { cyclic } from '../../../../libs/mathutils';
import { ArtProvider, BuildContext } from '../edit/editapi';
import { Board } from '../structs';
import { CachedBuildRenderableProvider, CachedHelperBuildRenderableProvider } from './cache';


function snapGrid(coord: number, gridSize: number): number {
  return Math.round(coord / gridSize) * gridSize;
}

export class Context implements BuildContext {
  readonly art: ArtProvider;
  readonly board: Board;
  readonly gl: WebGLRenderingContext;
  readonly geometry: CachedBuildRenderableProvider;
  readonly helpers: CachedHelperBuildRenderableProvider;

  private gridSizes = [16, 32, 64, 128, 256, 512, 1024];
  private gridSizeIdx = 3;

  constructor(art: ArtProvider, board: Board, gl: WebGLRenderingContext) {
    this.art = art;
    this.board = board;
    this.gl = gl;
    this.geometry = new CachedBuildRenderableProvider(this);
    this.helpers = new CachedHelperBuildRenderableProvider(this.geometry, this);
  }

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

  invalidateAll(): void {
    this.geometry.invalidateAll();
    this.helpers.invalidateAll();
  }

  invalidateSector(id: number): void {
    this.geometry.invalidateSector(id);
    this.helpers.invalidateSector(id);
  }

  invalidateWall(id: number): void {
    this.geometry.invalidateWall(id);
    this.helpers.invalidateWall(id);
  }

  invalidateSprite(id: number): void {
    this.geometry.invalidateSprite(id);
    this.helpers.invalidateSprite(id);
  }
}