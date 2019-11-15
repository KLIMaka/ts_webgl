import { RenderablesCache } from "./gl/cache";
import { getPlayerStart, inSector, findSector, ZSCALE } from "./utils";
import { vec3 } from "../../../libs_js/glmatrix";
import { Controller2D } from "../../controller2d";
import { Message } from "./handlerapi";
import { Frame, NamedMessage, Mouse } from "./edit/messages";
import { len2d, int } from "../../../libs/mathutils";
import { VIEW_2D } from "./gl/context";
import { BuildContext, ViewPoint } from "./api";
import { Controller3D } from "../../controller3d";
import { Board } from "./structs";
import * as RENDERER2D from './gl/boardrenderer2d'
import * as RENDERER3D from './gl/boardrenderer3d'

function createViewPoint2d(gl: WebGLRenderingContext, board: Board, ctx: BuildContext, renderables: RenderablesCache) {
  let playerstart = getPlayerStart(board);
  let pointer = vec3.create();
  let control = new Controller2D();
  control.setPosition(playerstart.x, playerstart.y);
  ctx.state.register('zoom+', false);
  ctx.state.register('zoom-', false);
  RENDERER2D.init(ctx);

  return {
    get sec() { return playerstart.sectnum },
    get x() { return playerstart.x },
    get y() { return playerstart.y },
    get z() { return playerstart.z },

    getProjectionMatrix() { return control.getProjectionMatrix() },
    getTransformMatrix() { return control.getTransformMatrix() },
    getPosition() { return pointer },
    getForward() { return [0, -1, 0] },
    unproject(x: number, y: number) { return [0, -1, 0] },
    activate() { control.setPosition(playerstart.x, playerstart.y) },

    handle(msg: Message, ctx: BuildContext) {
      if (msg instanceof Mouse) {
        control.track(msg.x, msg.y, ctx.state.get('lookaim'));
        let x = (msg.x / ctx.gl.drawingBufferWidth) * 2 - 1;
        let y = (msg.y / ctx.gl.drawingBufferHeight) * 2 - 1;
        let p = control.getPointerPosition(pointer, x, y);

        playerstart.x = int(p[0]);
        playerstart.y = int(p[2]);
        if (!inSector(board, playerstart.x, playerstart.y, playerstart.sectnum))
          playerstart.sectnum = findSector(board, playerstart.x, playerstart.y, playerstart.sectnum);
      } else if (msg instanceof Frame) {
        control.setSize(ctx.gl.drawingBufferWidth, ctx.gl.drawingBufferHeight);
        let max = control.getPointerPosition(pointer, 1, 1);
        let campos = control.getPosition();
        let dist = len2d(max[0] - campos[0], max[2] - campos[2]);
        RENDERER2D.draw(renderables.topdown, this, campos, dist);

        let state = ctx.state;
        if (state.get('zoom+')) control.setUnitsPerPixel(control.getUnitsPerPixel() / 1.1);
        if (state.get('zoom-')) control.setUnitsPerPixel(control.getUnitsPerPixel() * 1.1);
      }
    }
  }
}

function createViewPoint3d(gl: WebGLRenderingContext, board: Board, ctx: BuildContext, renderables: RenderablesCache, impl: RENDERER3D.Implementation) {
  let playerstart = getPlayerStart(board);
  let control = new Controller3D();
  control.setFov(90);
  control.setPosition(playerstart.x, playerstart.z / ZSCALE + 1024, playerstart.y);
  let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
  ctx.state.register('forward', false);
  ctx.state.register('backward', false);
  ctx.state.register('strafe_left', false);
  ctx.state.register('strafe_right', false);
  ctx.state.register('camera_speed', 8000);
  RENDERER3D.init(ctx, impl);

  return {
    get sec() { return playerstart.sectnum },
    get x() { return playerstart.x },
    get y() { return playerstart.y },
    get z() { return playerstart.z },

    getProjectionMatrix() { return control.getProjectionMatrix(aspect) },
    getTransformMatrix() { return control.getTransformMatrix() },
    getPosition() { return control.getPosition() },
    getForward() { return control.getForward() },
    unproject(x: number, y: number) { return control.getForwardUnprojected(aspect, x, y) },
    activate() { control.setPosition(playerstart.x, playerstart.z / ZSCALE + 1024, playerstart.y) },

    handle(msg: Message, ctx: BuildContext) {
      if (msg instanceof Mouse) {
        control.track(msg.x, msg.y, ctx.state.get('lookaim'));
      } else if (msg instanceof Frame) {
        aspect = ctx.gl.drawingBufferWidth / ctx.gl.drawingBufferHeight;
        RENDERER3D.draw(renderables.geometry, this);

        let state = ctx.state;
        let dt = msg.dt;
        let cameraSpeed = ctx.state.get<number>('camera_speed');

        if (state.get('forward')) control.moveForward(dt * cameraSpeed);
        if (state.get('backward')) control.moveForward(-dt * cameraSpeed);
        if (state.get('strafe_left')) control.moveSideway(-dt * cameraSpeed);
        if (state.get('strafe_right')) control.moveSideway(dt * cameraSpeed);

        let p = control.getPosition();
        playerstart.x = int(p[0]);
        playerstart.y = int(p[2]);
        playerstart.z = int(p[1] * ZSCALE);
        if (!inSector(board, playerstart.x, playerstart.y, playerstart.sectnum))
          playerstart.sectnum = findSector(board, playerstart.x, playerstart.y, playerstart.sectnum);
      }
    }
  }
}

export function createView(gl: WebGLRenderingContext, board: Board, ctx: BuildContext, renderables: RenderablesCache, impl: RENDERER3D.Implementation) {
  ctx.state.register('lookaim', false);
  let view2d = createViewPoint2d(gl, board, ctx, renderables);
  let view3d = createViewPoint3d(gl, board, ctx, renderables, impl);
  let view = view3d;
  ctx.state.register('viewpoint', view);

  return {
    get sec() { return view.sec },
    get x() { return view.x },
    get y() { return view.y },
    get z() { return view.z },
    getProjectionMatrix() { return view.getProjectionMatrix() },
    getTransformMatrix() { return view.getTransformMatrix() },
    getPosition() { return view.getPosition() },
    getForward() { return view.getForward() },
    unproject(x: number, y: number) { return view.unproject(x, y) },
    handle(message: Message, ctx: BuildContext) {
      if (message instanceof NamedMessage && message.name == 'view_mode') {
        view = ctx.state.get(VIEW_2D) ? view2d : view3d;
        ctx.state.set('viewpoint', view);
        view.activate();
      }
      view.handle(message, ctx)
    }
  }
}