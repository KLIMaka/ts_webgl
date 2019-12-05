import { CachedValue } from "../../../libs/cachedvalue";
import { int, len2d, tuple2 } from "../../../libs/mathutils";
import { vec3 } from "../../../libs_js/glmatrix";
import { Controller2D } from "../../controller2d";
import { Controller3D } from "../../controller3d";
import { BuildContext, Target, View } from "./api";
import { closestWallInSector, closestWallSegment, closestWallSegmentInSector, DEFAULT_REPEAT_RATE, nextwall, closestWallPoint } from "./boardutils";
import { Frame, Mouse, NamedMessage } from "./edit/messages";
import * as RENDERER2D from './gl/boardrenderer2d';
import * as RENDERER3D from './gl/boardrenderer3d';
import * as BGL from './gl/buildgl';
import { RenderablesCache } from "./gl/cache";
import { BuildRenderableProvider, Renderable } from "./gl/renderable";
import { Message, MessageHandler, MessageHandlerReflective } from "./handlerapi";
import { Entity, EntityType, Hitscan, hitscan, Ray } from "./hitscan";
import { Sprite } from "./structs";
import { findSector, getPlayerStart, gl2build, inSector, sectorOfWall, ZSCALE, build2gl } from "./utils";

class TargetImpl implements Target {
  public coords_: [number, number, number] = [0, 0, 0];
  public entity_: Entity = null;
  get coords() { return this.coords_ }
  get entity() { return this.entity_ }
}

const snapResult: [number, number] = [0, 0];
function snapWall(w: number, x: number, y: number, ctx: BuildContext) {
  const wall = ctx.board.walls[w];
  const w1 = nextwall(ctx.board, w);
  const wall1 = ctx.board.walls[w1];
  const dx = wall1.x - wall.x;
  const dy = wall1.y - wall.y;
  const repeat = DEFAULT_REPEAT_RATE * wall.xrepeat;
  const dxt = x - wall.x;
  const dyt = y - wall.y;
  const dt = len2d(dxt, dyt) / len2d(dx, dy);
  const t = ctx.snap(dt * repeat) / repeat;
  const xs = int(wall.x + (t * dx));
  const ys = int(wall.y + (t * dy));
  return tuple2(snapResult, xs, ys);
}

export class View2d extends MessageHandlerReflective implements View {
  readonly gl: WebGLRenderingContext;
  readonly renderables: BuildRenderableProvider;

  private playerstart: Sprite;
  private control = new Controller2D();
  private pointer = vec3.create();
  private ctx: BuildContext;
  private hit = new CachedValue((h: Hitscan) => this.updateHitscan(h), new Hitscan());
  private snapTargetValue = new CachedValue((t: TargetImpl) => this.updateSnapTarget(t), new TargetImpl());
  private direction = new CachedValue((r: Ray) => this.updateDir(r), new Ray());

  constructor(gl: WebGLRenderingContext, renderables: BuildRenderableProvider) {
    super();
    this.gl = gl;
    this.renderables = renderables;
  }

  get sec() { return this.playerstart.sectnum }
  get x() { return this.playerstart.x }
  get y() { return this.playerstart.y }
  get z() { return this.playerstart.z }

  getProjectionMatrix() { return this.control.getProjectionMatrix() }
  getTransformMatrix() { return this.control.getTransformMatrix() }
  getPosition() { return this.pointer }
  activate() { this.control.setPosition(this.playerstart.x, this.playerstart.y) }
  draw(renderable: Renderable) { BGL.draw(this.ctx, this.gl, renderable) }
  target(): Target { return this.hit.get() }
  snapTarget(): Target { return this.snapTargetValue.get() }
  dir(): Ray { return this.direction.get() }
  isWireframe() { return true }

  Mouse(msg: Mouse, ctx: BuildContext) {
    this.control.track(msg.x, msg.y, ctx.state.get('lookaim'));
    const x = (msg.x / this.gl.drawingBufferWidth) * 2 - 1;
    const y = (msg.y / this.gl.drawingBufferHeight) * 2 - 1;
    const p = this.control.getPointerPosition(this.pointer, x, y);

    this.playerstart.x = int(p[0]);
    this.playerstart.y = int(p[2]);
    if (!inSector(ctx.board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum))
      this.playerstart.sectnum = findSector(ctx.board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum);
  }

  Frame(msg: Message, ctx: BuildContext) {
    this.snapTargetValue.invalidate();
    this.direction.invalidate();
    this.hit.invalidate();
    this.control.setSize(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
    const max = this.control.getPointerPosition(this.pointer, 1, 1);
    const campos = this.control.getPosition();
    const dist = len2d(max[0] - campos[0], max[2] - campos[2]);
    BGL.newFrame(this.gl);
    RENDERER2D.draw(this, campos, dist);

    const state = ctx.state;
    if (state.get('zoom+')) this.control.setUnitsPerPixel(this.control.getUnitsPerPixel() / 1.1);
    if (state.get('zoom-')) this.control.setUnitsPerPixel(this.control.getUnitsPerPixel() * 1.1);
  }

  bind(ctx: BuildContext) {
    this.ctx = ctx;
    this.playerstart = getPlayerStart(ctx.board);
    this.pointer = vec3.create();
    this.control.setPosition(this.playerstart.x, this.playerstart.y);
    ctx.state.register('zoom+', false);
    ctx.state.register('zoom-', false);
    RENDERER2D.init(this.gl, ctx);
  }

  private updateHitscan(hit: Hitscan) {
    hitscan(this.ctx.board, this.ctx.art, this.x, this.y, this.z, this.sec, 0, 0, -1 * ZSCALE, hit, 0);
    return hit;
  }

  private updateSnapTarget(target: TargetImpl) {
    const d = this.ctx.gridScale / 2;
    const w = closestWallPoint(this.ctx.board, this.x, this.y, d);
    if (w != -1) {
      const wall = this.ctx.board.walls[w];
      target.coords_[0] = wall.x
      target.coords_[1] = wall.y;
      target.entity_ = new Entity(w, EntityType.WALL_POINT);
      return target;
    }
    const ws = closestWallSegment(this.ctx.board, this.x, this.y, d);
    if (ws != -1) {
      const [x, y] = snapWall(ws, this.x, this.y, this.ctx);
      target.coords_[0] = x;
      target.coords_[1] = y;
      target.entity_ = new Entity(ws, EntityType.MID_WALL);
      return target;
    }
    target.coords_[0] = this.ctx.snap(this.x);
    target.coords_[1] = this.ctx.snap(this.y);
    const sectorId = findSector(this.ctx.board, this.x, this.y, this.sec);
    target.entity_ = sectorId == -1 ? null : new Entity(sectorId, EntityType.FLOOR);
    return target;
  }

  private updateDir(ray: Ray): Ray {
    vec3.set(ray.start, this.x, this.y, this.z);
    vec3.set(ray.dir, 0, 0, -1 * ZSCALE);
    return ray;
  }
}

export class View3d extends MessageHandlerReflective implements View {
  readonly gl: WebGLRenderingContext;
  readonly renderables: BuildRenderableProvider;

  private playerstart: Sprite;
  private aspect: number;
  private control = new Controller3D();
  private impl: RENDERER3D.Implementation;
  private ctx: BuildContext;
  private mouseX = 0;
  private mouseY = 0;
  private hit = new CachedValue((h: Hitscan) => this.updateHitscan(h), new Hitscan());
  private snapTargetValue = new CachedValue((t: TargetImpl) => this.updateSnapTarget(t), new TargetImpl());
  private direction = new CachedValue((r: Ray) => this.updateDir(r), new Ray());
  private cursor = vec3.create();

  constructor(gl: WebGLRenderingContext, renderables: BuildRenderableProvider, impl: RENDERER3D.Implementation) {
    super();
    this.gl = gl;
    this.renderables = renderables;
    this.impl = impl;
  }

  get sec() { return this.playerstart.sectnum }
  get x() { return this.playerstart.x }
  get y() { return this.playerstart.y }
  get z() { return this.playerstart.z }

  getProjectionMatrix() { return this.control.getProjectionMatrix(this.aspect) }
  getTransformMatrix() { return this.control.getTransformMatrix() }
  getPosition() { return this.control.getPosition() }
  getForward() { return this.control.getForward() }
  activate() { this.control.setPosition(this.playerstart.x, this.playerstart.z / ZSCALE + 1024, this.playerstart.y) }
  draw(renderable: Renderable) { BGL.draw(this.ctx, this.gl, renderable) }
  target(): Target { return this.hit.get() }
  snapTarget(): Target { return this.snapTargetValue.get() }
  dir(): Ray { return this.direction.get() }
  isWireframe() { return false }

  Mouse(msg: Mouse, ctx: BuildContext) {
    this.mouseX = msg.x;
    this.mouseY = msg.y;
    this.control.track(msg.x, msg.y, ctx.state.get('lookaim'));
  }

  Frame(msg: Frame, ctx: BuildContext) {
    this.snapTargetValue.invalidate();
    this.direction.invalidate();
    this.hit.invalidate();
    build2gl(this.cursor, this.snapTarget().coords);
    BGL.setCursorPosiotion(this.cursor[0], this.cursor[1], this.cursor[2]);
    this.aspect = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
    BGL.newFrame(this.gl);
    RENDERER3D.draw(this);

    const state = ctx.state;
    const dt = msg.dt;
    const cameraSpeed = ctx.state.get<number>('camera_speed');

    if (state.get('forward')) this.control.moveForward(dt * cameraSpeed);
    if (state.get('backward')) this.control.moveForward(-dt * cameraSpeed);
    if (state.get('strafe_left')) this.control.moveSideway(-dt * cameraSpeed);
    if (state.get('strafe_right')) this.control.moveSideway(dt * cameraSpeed);

    const p = this.control.getPosition();
    this.playerstart.x = int(p[0]);
    this.playerstart.y = int(p[2]);
    this.playerstart.z = int(p[1] * ZSCALE);
    if (!inSector(ctx.board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum))
      this.playerstart.sectnum = findSector(ctx.board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum);
  }

  bind(ctx: BuildContext) {
    this.ctx = ctx;
    this.playerstart = getPlayerStart(ctx.board);
    this.control.setFov(90);
    this.control.setPosition(this.playerstart.x, this.playerstart.z / ZSCALE + 1024, this.playerstart.y);
    this.aspect = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
    ctx.state.register('forward', false);
    ctx.state.register('backward', false);
    ctx.state.register('strafe_left', false);
    ctx.state.register('strafe_right', false);
    ctx.state.register('camera_speed', 8000);
    RENDERER3D.init(this.gl, ctx, this.impl);
  }

  private updateHitscan(hit: Hitscan): Target {
    const { start, dir } = this.dir();
    hitscan(this.ctx.board, this.ctx.art, start[0], start[1], start[2], this.sec, dir[0], dir[1], dir[2], hit, 0);
    return hit;
  }

  private getClosestWall(target: Target, d: number): number {
    const [x, y] = target.coords;
    if (target.entity.isWall())
      return closestWallInSector(this.ctx.board, sectorOfWall(this.ctx.board, target.entity.id), x, y, d);
    else if (target.entity.isSector())
      return closestWallInSector(this.ctx.board, target.entity.id, x, y, d);
    return -1;
  }

  private snapGrid(target: Target, t: TargetImpl) {
    t.coords_[0] = this.ctx.snap(target.coords[0]);
    t.coords_[1] = this.ctx.snap(target.coords[1]);
    t.coords_[2] = this.ctx.snap(target.coords[2]);
    t.entity_ = target.entity.clone();
    return t;
  }

  private snapWall(target: Target, wallId: number, t: TargetImpl) {
    const [x, y] = snapWall(wallId, target.coords[0], target.coords[1], this.ctx);
    t.coords_[0] = x;
    t.coords_[1] = y;
    t.coords_[2] = target.coords[2];
    t.entity_ = new Entity(wallId, EntityType.MID_WALL);
    return t;
  }

  private snapWallPoint(target: Target, wallId: number, t: TargetImpl) {
    const wall = this.ctx.board.walls[wallId];
    t.coords_[0] = wall.x;
    t.coords_[1] = wall.y;
    t.coords_[2] = target.coords[2];
    t.entity_ = new Entity(wallId, EntityType.WALL_POINT);
    return t;
  }

  private snapSprite(target: Target, t: TargetImpl) {
    const sprite = this.ctx.board.sprites[target.entity.id];
    t.coords_[0] = sprite.x;
    t.coords_[1] = sprite.y;
    t.coords_[2] = sprite.z;
    t.entity_ = target.entity.clone();
    return t;
  }

  private copyTarget(target: Target, t: TargetImpl) {
    t.coords_[0] = target.coords[0];
    t.coords_[1] = target.coords[1];
    t.coords_[2] = target.coords[2];
    t.entity_ = null;
    return t;
  }

  private updateSnapTarget(t: TargetImpl): Target {
    const target = this.target();
    if (target.entity == null) return this.copyTarget(target, t);
    const d = this.ctx.gridScale / 2;
    const w = this.getClosestWall(target, d);
    if (w != -1) {
      return this.snapWallPoint(target, w, t);
    } else if (target.entity.isSector()) {
      const w = closestWallSegmentInSector(this.ctx.board, target.entity.id, target.coords[0], target.coords[1], d);
      return w == -1 ? this.snapGrid(target, t) : this.snapWall(target, w, t);
    } else if (target.entity.isSprite()) {
      return this.snapSprite(target, t);
    } else if (target.entity.isWall()) {
      return this.snapWall(target, target.entity.id, t);
    }
  }

  private updateDir(r: Ray): Ray {
    vec3.set(r.start, this.x, this.y, this.z);
    const x = (this.mouseX / this.gl.drawingBufferWidth) * 2 - 1;
    const y = (this.mouseY / this.gl.drawingBufferHeight) * 2 - 1;
    gl2build(r.dir, this.control.getForwardUnprojected(this.aspect, x, y));
    return r;
  }
}

export class SwappableView implements View, MessageHandler {
  private gl: WebGLRenderingContext;
  private view: View2d | View3d;
  private view2d: View2d;
  private view3d: View3d;
  private renderables: RenderablesCache;
  private impl: RENDERER3D.Implementation;

  constructor(gl: WebGLRenderingContext, renderables: RenderablesCache, impl: RENDERER3D.Implementation) {
    this.gl = gl;
    this.renderables = renderables;
    this.impl = impl;
  }

  get sec() { return this.view.sec }
  get x() { return this.view.x }
  get y() { return this.view.y }
  get z() { return this.view.z }

  target() { return this.view.target() }
  snapTarget() { return this.view.snapTarget() }
  dir() { return this.view.dir() }
  draw(renderable: Renderable) { this.view.draw(renderable) }
  isWireframe() { return this.view.isWireframe() }

  handle(message: Message, ctx: BuildContext) {
    if (message instanceof NamedMessage && message.name == 'view_mode') {
      this.view = this.view == this.view3d ? this.view2d : this.view3d;
      this.view.activate();
      return;
    }
    this.view.handle(message, ctx)
  }

  bind(ctx: BuildContext) {
    ctx.state.register('lookaim', false);
    this.view2d = new View2d(this.gl, this.renderables.topdown);
    this.view2d.bind(ctx);
    this.view3d = new View3d(this.gl, this.renderables.geometry, this.impl);
    this.view3d.bind(ctx);
    this.view = this.view3d;
  }
}