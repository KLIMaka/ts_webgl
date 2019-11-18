import { int, len2d } from "../../../libs/mathutils";
import { vec3 } from "../../../libs_js/glmatrix";
import { Controller2D } from "../../controller2d";
import { Controller3D } from "../../controller3d";
import { BuildContext, View } from "./api";
import { Frame, Mouse, NamedMessage } from "./edit/messages";
import * as RENDERER2D from './gl/boardrenderer2d';
import * as RENDERER3D from './gl/boardrenderer3d';
import * as BGL from './gl/buildgl';
import { RenderablesCache } from "./gl/cache";
import { VIEW_2D } from "./gl/context";
import { Message, MessageHandler } from "./handlerapi";
import { Sprite } from "./structs";
import { findSector, getPlayerStart, inSector, ZSCALE } from "./utils";
import { BuildRenderableProvider, Renderable } from "./gl/renderable";
import { Hitscan, hitscan } from "./hitscan";

export class View2d implements View, MessageHandler {
  readonly gl: WebGLRenderingContext;
  readonly renderables: BuildRenderableProvider;

  private playerstart: Sprite;
  private control = new Controller2D();
  private pointer = vec3.create();
  private ctx: BuildContext;

  constructor(gl: WebGLRenderingContext, renderables: BuildRenderableProvider) {
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

  handle(msg: Message, ctx: BuildContext) {
    if (msg instanceof Mouse) {
      this.control.track(msg.x, msg.y, ctx.state.get('lookaim'));
      let x = (msg.x / this.gl.drawingBufferWidth) * 2 - 1;
      let y = (msg.y / this.gl.drawingBufferHeight) * 2 - 1;
      let p = this.control.getPointerPosition(this.pointer, x, y);

      this.playerstart.x = int(p[0]);
      this.playerstart.y = int(p[2]);
      if (!inSector(ctx.board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum))
        this.playerstart.sectnum = findSector(ctx.board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum);
    } else if (msg instanceof Frame) {
      this.control.setSize(this.gl.drawingBufferWidth, this.gl.drawingBufferHeight);
      let max = this.control.getPointerPosition(this.pointer, 1, 1);
      let campos = this.control.getPosition();
      let dist = len2d(max[0] - campos[0], max[2] - campos[2]);
      RENDERER2D.draw(this, campos, dist);

      let state = ctx.state;
      if (state.get('zoom+')) this.control.setUnitsPerPixel(this.control.getUnitsPerPixel() / 1.1);
      if (state.get('zoom-')) this.control.setUnitsPerPixel(this.control.getUnitsPerPixel() * 1.1);
    }
  }

  bind(ctx: BuildContext) {
    this, ctx = ctx;
    this.playerstart = getPlayerStart(ctx.board);
    this.pointer = vec3.create();
    this.control.setPosition(this.playerstart.x, this.playerstart.y);
    ctx.state.register('zoom+', false);
    ctx.state.register('zoom-', false);
    RENDERER2D.init(this.gl, ctx);
  }

  hitscan(ctx: BuildContext, hit: Hitscan) {
    hitscan(ctx.board, ctx.art, this.x, this.y, this.z, this.sec, 0, 0, -1, hit, 0);
    return hit;
  }

}

export class View3d implements View, MessageHandler {
  readonly gl: WebGLRenderingContext;
  readonly renderables: BuildRenderableProvider;

  private playerstart: Sprite;
  private aspect: number;
  private control = new Controller3D();
  private impl: RENDERER3D.Implementation;
  private ctx: BuildContext;
  private mouseX = 0;
  private mouseY = 0;

  constructor(gl: WebGLRenderingContext, renderables: BuildRenderableProvider, impl: RENDERER3D.Implementation) {
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
  unproject(x: number, y: number) { return this.control.getForwardUnprojected(this.aspect, x, y) }
  activate() { this.control.setPosition(this.playerstart.x, this.playerstart.z / ZSCALE + 1024, this.playerstart.y) }
  draw(renderable: Renderable) { BGL.draw(this.ctx, this.gl, renderable) }

  handle(msg: Message, ctx: BuildContext) {
    if (msg instanceof Mouse) {
      this.mouseX = msg.x;
      this.mouseY = msg.y;
      this.control.track(msg.x, msg.y, ctx.state.get('lookaim'));
    } else if (msg instanceof Frame) {
      this.aspect = this.gl.drawingBufferWidth / this.gl.drawingBufferHeight;
      RENDERER3D.draw(this);

      let state = ctx.state;
      let dt = msg.dt;
      let cameraSpeed = ctx.state.get<number>('camera_speed');

      if (state.get('forward')) this.control.moveForward(dt * cameraSpeed);
      if (state.get('backward')) this.control.moveForward(-dt * cameraSpeed);
      if (state.get('strafe_left')) this.control.moveSideway(-dt * cameraSpeed);
      if (state.get('strafe_right')) this.control.moveSideway(dt * cameraSpeed);

      let p = this.control.getPosition();
      this.playerstart.x = int(p[0]);
      this.playerstart.y = int(p[2]);
      this.playerstart.z = int(p[1] * ZSCALE);
      if (!inSector(ctx.board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum))
        this.playerstart.sectnum = findSector(ctx.board, this.playerstart.x, this.playerstart.y, this.playerstart.sectnum);
    }
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


  hitscan(ctx: BuildContext, hit: Hitscan) {
    let x = (this.mouseX / this.gl.drawingBufferWidth) * 2 - 1;
    let y = (this.mouseY / this.gl.drawingBufferHeight) * 2 - 1;
    let [vx, vz, vy] = this.unproject(x, y);
    hitscan(ctx.board, ctx.art, this.x, this.y, this.z, this.sec, vx, vy, vz, hit, 0);
    return hit;
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
  hitscan(ctx: BuildContext, hit: Hitscan) { return this.view.hitscan(ctx, hit) }
  draw(renderable: Renderable) { this.view.draw(renderable) }

  handle(message: Message, ctx: BuildContext) {
    if (message instanceof NamedMessage && message.name == 'view_mode') {
      this.view = ctx.state.get(VIEW_2D) ? this.view2d : this.view3d;
      ctx.state.set('viewpoint', this.view);
      this.view.activate();
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
    ctx.state.register('viewpoint', this.view);
  }
}