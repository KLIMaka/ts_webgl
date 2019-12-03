import * as GLM from '../../../../libs_js/glmatrix';
import { EntityType } from '../hitscan';
import { buildCeilingHinge, buildFloorHinge, updateSectorWireframe, genGridMatrix, SectorHelper, updateSector, updateSprite, updateSpriteAngle, updateSpriteWireframe, updateWall, updateWallLine, updateWallPointCeiling, updateWallPointFloor, updateWallWireframe, WallHelper, updateSector2d, updateWall2d } from './builders';
import { GridRenderable, NULL_RENDERABLE, Renderable, RenderableList, Solid, BuildRenderableProvider, SectorRenderable, WallRenderable, Wireframe, wrapState, notStatePred, wrapStatePred } from './renderable';
import { BuildContext, BoardInvalidator } from '../api';
import { View3d } from '../view';

class Entry<T> {
  constructor(public value: T, public valid: boolean = false) { }
  update(value: T) { this.value = value; this.valid = true; }
}

class CacheMap<T extends Renderable> {
  constructor(
    readonly update: (ctx: BuildContext, id: number, value: T) => T
  ) { }

  private cache: { [index: number]: Entry<T> } = {};

  get(id: number, ctx: BuildContext): T {
    let v = this.ensureValue(id);
    if (!v.valid) v.update(this.update(ctx, id, v.value));
    return v.value;
  }

  private ensureValue(id: number) {
    let v = this.cache[id];
    if (v == undefined) {
      v = new Entry<T>(null);
      this.cache[id] = v;
    }
    return v;
  }

  invalidate(id: number) {
    let v = this.cache[id];
    if (v == undefined) return;
    v.value.reset();
    v.valid = false;
  }

  invalidateAll() {
    for (let id in this.cache) {
      this.invalidate(<any>id);
    }
  }
}

export class CachedTopDownBuildRenderableProvider implements BuildRenderableProvider, BoardInvalidator {
  private sectors = new CacheMap(updateSector2d);
  private walls = new CacheMap(updateWall2d);
  private sprites = new CacheMap(updateSprite);
  private ctx: BuildContext;


  bind(ctx: BuildContext): void {
    this.ctx = ctx;
  }

  sector(id: number): SectorRenderable {
    return this.sectors.get(id, this.ctx);
  }

  wall(id: number): WallRenderable {
    return this.walls.get(id, this.ctx);
  }

  wallPoint(id: number): Renderable {
    throw new Error('Cant render points');
  }

  sprite(id: number): Renderable {
    return this.sprites.get(id, this.ctx);
  }

  invalidateSector(id: number) {
    this.sectors.invalidate(id);
  }

  invalidateWall(id: number) {
    this.walls.invalidate(id);
  }

  invalidateSprite(id: number) {
    this.sprites.invalidate(id);
  }

  invalidateAll() {
    this.sectors.invalidateAll();
    this.walls.invalidateAll();
    this.sprites.invalidateAll();
  }
}

export class CachedBuildRenderableProvider implements BuildRenderableProvider, BoardInvalidator {
  private sectors = new CacheMap(updateSector);
  private walls = new CacheMap(updateWall);
  private sprites = new CacheMap(updateSprite);
  private ctx: BuildContext;


  bind(ctx: BuildContext): void {
    this.ctx = ctx;
  }

  sector(id: number): SectorRenderable {
    return this.sectors.get(id, this.ctx);
  }

  wall(id: number): WallRenderable {
    return this.walls.get(id, this.ctx);
  }

  wallPoint(id: number): Renderable {
    throw new Error('Cant render points');
  }

  sprite(id: number): Renderable {
    return this.sprites.get(id, this.ctx);
  }

  invalidateSector(id: number) {
    this.sectors.invalidate(id);
  }

  invalidateWall(id: number) {
    this.walls.invalidate(id);
  }

  invalidateSprite(id: number) {
    this.sprites.invalidate(id);
  }

  invalidateAll() {
    this.sectors.invalidateAll();
    this.walls.invalidateAll();
    this.sprites.invalidateAll();
  }
}


export class CachedHelperBuildRenderableProvider implements BuildRenderableProvider, BoardInvalidator {
  private sectors: CacheMap<SectorHelper>;
  private walls: CacheMap<WallHelper>;
  private sprites: CacheMap<Renderable>;
  private wallPoints: CacheMap<Renderable>;
  private ctx: BuildContext;

  constructor(readonly cache: CachedBuildRenderableProvider) {
    this.sectors = new CacheMap((ctx: BuildContext, id: number, value: SectorHelper) => { return this.updateSectorHelper(id, value) });
    this.walls = new CacheMap((ctx: BuildContext, id: number, value: WallHelper) => { return this.updateWallHelper(id, value) });
    this.sprites = new CacheMap((ctx: BuildContext, id: number, value: Renderable) => { return this.updateSpriteHelper(id, value) });
    this.wallPoints = new CacheMap((ctx: BuildContext, id: number, value: Renderable) => { return this.updateWallPoint(id, value) });
  }

  bind(ctx: BuildContext): void {
    this.ctx = ctx;
  }

  sector(id: number): SectorRenderable {
    return this.sectors.get(id, this.ctx);
  }

  wall(id: number): WallRenderable {
    return this.walls.get(id, this.ctx);
  }

  wallPoint(id: number): Renderable {
    return this.wallPoints.get(id, this.ctx);
  }

  sprite(id: number): Renderable {
    return this.sprites.get(id, this.ctx);
  }

  invalidateSector(id: number) {
    this.sectors.invalidate(id);
  }

  invalidateWall(id: number) {
    this.walls.invalidate(id);
    this.wallPoints.invalidate(id);
  }

  invalidateSprite(id: number) {
    this.sprites.invalidate(id);
  }

  invalidateAll() {
    this.sectors.invalidateAll();
    this.walls.invalidateAll();
    this.sprites.invalidateAll();
    this.wallPoints.invalidateAll();
  }

  private updateSectorHelper(secId: number, renderable: SectorHelper): SectorHelper {
    if (renderable == null) renderable = new SectorHelper();
    renderable.reset();


    let ceiling2d = new Array<Renderable>();
    let floor2d = new Array<Renderable>();
    let sectorRenderable = this.cache.sector(secId);
    let ceilingGrid = new GridRenderable();
    let gridMatrix = GLM.mat4.copy(GLM.mat4.create(), genGridMatrix(this.ctx.board, secId, EntityType.CEILING));
    ceilingGrid.gridTexMat = gridMatrix;
    ceilingGrid.solid = <Solid>sectorRenderable.ceiling;
    ceiling2d.push(ceilingGrid);
    let floorGrid = new GridRenderable();
    floorGrid.gridTexMat = gridMatrix;
    floorGrid.solid = <Solid>sectorRenderable.floor;
    floor2d.push(floorGrid);

    let sec = this.ctx.board.sectors[secId];
    let end = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < end; w++) {
      ceiling2d.push(updateWallPointCeiling(this.ctx, w));
      floor2d.push(updateWallPointFloor(this.ctx, w));
    }

    let ceiling = new Array<Renderable>();
    let floor = new Array<Renderable>();
    let sectorWireframe = updateSectorWireframe(this.ctx, secId);
    ceiling.push(sectorWireframe.ceiling);
    floor.push(sectorWireframe.floor);
    ceiling.push(buildCeilingHinge(this.ctx, secId));
    floor.push(buildFloorHinge(this.ctx, secId));

    renderable.ceiling = new RenderableList([...ceiling2d, wrapStatePred((ctx: BuildContext) => !ctx.view.isWireframe(), new RenderableList(ceiling))]);
    renderable.floor = new RenderableList([...floor2d, wrapStatePred((ctx: BuildContext) => !ctx.view.isWireframe(), new RenderableList(floor))]);
    return renderable;
  }

  private addWallPoints(wallId: number, ceiling: boolean): Renderable {
    let arr = new Array<Renderable>();
    arr.push(ceiling ? updateWallPointCeiling(this.ctx, wallId) : updateWallPointFloor(this.ctx, wallId));
    let wallId2 = this.ctx.board.walls[wallId].point2;
    arr.push(ceiling ? updateWallPointCeiling(this.ctx, wallId2) : updateWallPointFloor(this.ctx, wallId2));
    return new RenderableList(arr);
  }

  private addWallPart(solid: Solid, mat: GLM.Mat4Array, wire: Renderable, points: Renderable): Renderable {
    let arr = new Array<Renderable>();
    arr.push(wire);
    let wallGrid = new GridRenderable();
    wallGrid.gridTexMat = mat;
    wallGrid.solid = solid;
    arr.push(wallGrid);
    arr.push(points);
    return new RenderableList(arr);
  }

  private updateWallHelper(wallId: number, renderable: WallHelper): WallHelper {
    if (renderable == null) renderable = new WallHelper();
    renderable.reset();
    let wallWireframe = updateWallWireframe(this.ctx, wallId);
    let wallRenderable = this.cache.wall(wallId);
    let gridMatrix = GLM.mat4.copy(GLM.mat4.create(), genGridMatrix(this.ctx.board, wallId, EntityType.MID_WALL));
    renderable.top = this.addWallPart(<Solid>wallRenderable.top, gridMatrix, wallWireframe.top, this.addWallPoints(wallId, true));
    renderable.mid = this.addWallPart(<Solid>wallRenderable.mid, gridMatrix, wallWireframe.mid, NULL_RENDERABLE);
    renderable.bot = this.addWallPart(<Solid>wallRenderable.bot, gridMatrix, wallWireframe.bot, this.addWallPoints(wallId, false));
    return renderable;
  }

  private updateSpriteHelper(sprId: number, renderable: Renderable): Renderable {
    if (renderable != null) renderable.reset();
    let list = new Array<Renderable>();
    list.push(updateSpriteWireframe(this.ctx, sprId));
    list.push(updateSpriteAngle(this.ctx, sprId));
    return new RenderableList(list);
  }

  private updateWallPoint(wallId: number, renderable: Renderable): Renderable {
    if (renderable != null) renderable.reset();
    let list = new Array<Renderable>();
    list.push(updateWallPointCeiling(this.ctx, wallId));
    list.push(updateWallPointFloor(this.ctx, wallId));
    list.push(updateWallLine(this.ctx, wallId));
    return new RenderableList(list);
  }
}

export class RenderablesCache implements BoardInvalidator {
  readonly geometry: CachedBuildRenderableProvider;
  readonly helpers: CachedHelperBuildRenderableProvider;
  readonly topdown: CachedTopDownBuildRenderableProvider;

  constructor() {
    this.geometry = new CachedBuildRenderableProvider();
    this.helpers = new CachedHelperBuildRenderableProvider(this.geometry);
    this.topdown = new CachedTopDownBuildRenderableProvider();
  }

  bind(ctx: BuildContext): void {
    this.geometry.bind(ctx);
    this.helpers.bind(ctx);
    this.topdown.bind(ctx);
  }

  invalidateAll(): void {
    this.geometry.invalidateAll();
    this.helpers.invalidateAll();
    this.topdown.invalidateAll();
  }

  invalidateSector(id: number): void {
    this.geometry.invalidateSector(id);
    this.helpers.invalidateSector(id);
    this.topdown.invalidateSector(id);
  }

  invalidateWall(id: number): void {
    this.geometry.invalidateWall(id);
    this.helpers.invalidateWall(id);
    this.topdown.invalidateWall(id);
  }

  invalidateSprite(id: number): void {
    this.geometry.invalidateSprite(id);
    this.helpers.invalidateSprite(id);
    this.topdown.invalidateSprite(id);
  }
}

