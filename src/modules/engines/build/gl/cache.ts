import * as GLM from '../../../../libs_js/glmatrix';
import { BuildContext } from '../api';
import { BoardInvalidate } from '../edit/messages';
import { MessageHandlerReflective } from '../handlerapi';
import { buildCeilingHinge, buildFloorHinge, createGridMatrixProviderWall, gridMatrixProviderSector, SectorHelper, updateSector, updateSector2d, updateSectorWireframe, updateSprite, updateSpriteAngle, updateSpriteWireframe, updateWall, updateWall2d, updateWallLine, updateWallPointCeiling, updateWallPointFloor, updateWallWireframe, WallHelper, updateSprite2d, writeText, text } from './builders';
import { BuildRenderableProvider, GridRenderable, NULL_RENDERABLE, Renderable, RenderableList, SectorRenderable, Solid, WallRenderable, wrapStatePred } from './renderable';
import { walllen } from '../boardutils';
import { int } from '../../../../libs/mathutils';
import { slope, sectorOfWall, ZSCALE } from '../utils';

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

export class CachedTopDownBuildRenderableProvider implements BuildRenderableProvider {
  private sectors = new CacheMap(updateSector2d);
  private walls = new CacheMap(updateWall2d);
  private sprites = new CacheMap(updateSprite2d);
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

export class CachedBuildRenderableProvider implements BuildRenderableProvider {
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


export class CachedHelperBuildRenderableProvider implements BuildRenderableProvider {
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
    const pointTex = this.ctx.art.get(-1);

    let sec = this.ctx.board.sectors[secId];
    let end = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < end; w++) {
      ceiling2d.push(updateWallPointCeiling(this.ctx, w, pointTex));
      floor2d.push(updateWallPointFloor(this.ctx, w, pointTex));
    }

    let ceiling = new Array<Renderable>();
    let floor = new Array<Renderable>();
    let sectorWireframe = updateSectorWireframe(this.ctx, secId);
    ceiling.push(sectorWireframe.ceiling);
    floor.push(sectorWireframe.floor);
    ceiling.push(buildCeilingHinge(this.ctx, secId));
    floor.push(buildFloorHinge(this.ctx, secId));
    let sectorRenderable = this.cache.sector(secId);
    let ceilingGrid = new GridRenderable();
    ceilingGrid.gridTexMatProvider = gridMatrixProviderSector;
    ceilingGrid.solid = <Solid>sectorRenderable.ceiling;
    ceiling.push(ceilingGrid);
    let floorGrid = new GridRenderable();
    floorGrid.gridTexMatProvider = gridMatrixProviderSector;
    floorGrid.solid = <Solid>sectorRenderable.floor;
    floor.push(floorGrid);

    const pred = (ctx: BuildContext) => !ctx.view.isWireframe();
    renderable.ceiling = new RenderableList([wrapStatePred(pred, new RenderableList(ceiling)), ...ceiling2d]);
    renderable.floor = new RenderableList([wrapStatePred(pred, new RenderableList(floor)), ...floor2d]);
    return renderable;
  }

  private addWallPoints(wallId: number, ceiling: boolean): Renderable {
    const arr = new Array<Renderable>();
    const pointTex = this.ctx.art.get(-1);
    arr.push(ceiling ? updateWallPointCeiling(this.ctx, wallId, pointTex) : updateWallPointFloor(this.ctx, wallId, pointTex));
    const wallId2 = this.ctx.board.walls[wallId].point2;
    arr.push(ceiling ? updateWallPointCeiling(this.ctx, wallId2, pointTex) : updateWallPointFloor(this.ctx, wallId2, pointTex));
    const wall = this.ctx.board.walls[wallId];
    const wall2 = this.ctx.board.walls[wallId2];
    const cx = int(wall.x + (wall2.x - wall.x) * 0.5);
    const cy = int(wall.y + (wall2.y - wall.y) * 0.5);
    const sectorId = sectorOfWall(this.ctx.board, wallId);
    const sector = this.ctx.board.sectors[sectorId];
    const fz = slope(this.ctx.board, sectorId, cx, cy, sector.floorheinum) + sector.floorz;
    const cz = slope(this.ctx.board, sectorId, cx, cy, sector.ceilingheinum) + sector.ceilingz;
    const length = walllen(this.ctx.board, wallId).toFixed(2).replace(/\.00$/, "");
    arr.push(text(length, cx, cy, (ceiling ? cz : fz) / ZSCALE, 8, 8, this.ctx.art.get(-2)));
    return new RenderableList(arr);
  }

  private addWallPart(solid: Solid, matProvider: (scale: number) => GLM.Mat4Array, wire: Renderable, points: Renderable): Renderable {
    let arr = new Array<Renderable>();
    arr.push(wire);
    let wallGrid = new GridRenderable();
    wallGrid.gridTexMatProvider = matProvider;
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
    let gridMatrix = createGridMatrixProviderWall(this.ctx.board, wallId);
    renderable.top = this.addWallPart(<Solid>wallRenderable.top, gridMatrix, wallWireframe.top, this.addWallPoints(wallId, true));
    renderable.mid = this.addWallPart(<Solid>wallRenderable.mid, gridMatrix, wallWireframe.mid, NULL_RENDERABLE);
    renderable.bot = this.addWallPart(<Solid>wallRenderable.bot, gridMatrix, wallWireframe.bot, this.addWallPoints(wallId, false));
    return renderable;
  }

  private updateSpriteHelper(sprId: number, renderable: Renderable): Renderable {
    if (renderable != null) renderable.reset();
    let list = new Array<Renderable>();
    list.push(updateSpriteWireframe(this.ctx, sprId));
    list.push(updateSpriteAngle(this.ctx, sprId, null));
    return new RenderableList(list);
  }

  private updateWallPoint(wallId: number, renderable: Renderable): Renderable {
    if (renderable != null) renderable.reset();
    const pointTex = this.ctx.art.get(-1);
    let list = new Array<Renderable>();
    list.push(updateWallPointCeiling(this.ctx, wallId, pointTex));
    list.push(updateWallPointFloor(this.ctx, wallId, pointTex));
    list.push(updateWallLine(this.ctx, wallId));
    return new RenderableList(list);
  }
}

export class RenderablesCache extends MessageHandlerReflective {
  readonly geometry: CachedBuildRenderableProvider;
  readonly helpers: CachedHelperBuildRenderableProvider;
  readonly topdown: CachedTopDownBuildRenderableProvider;

  constructor() {
    super();
    this.geometry = new CachedBuildRenderableProvider();
    this.helpers = new CachedHelperBuildRenderableProvider(this.geometry);
    this.topdown = new CachedTopDownBuildRenderableProvider();
  }

  bind(ctx: BuildContext): void {
    this.geometry.bind(ctx);
    this.helpers.bind(ctx);
    this.topdown.bind(ctx);
  }

  BoardInvalidate(msg: BoardInvalidate, ctx: BuildContext) {
    if (msg.ent == null) this.invalidateAll();
    else if (msg.ent.isSector()) this.invalidateSector(msg.ent.id);
    else if (msg.ent.isSprite()) this.invalidateSprite(msg.ent.id);
    else if (msg.ent.isWall()) this.invalidateWall(msg.ent.id);
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

