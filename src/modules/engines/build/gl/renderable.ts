import * as GLM from '../../../../libs_js/glmatrix';
import { vec4 } from '../../../../libs_js/glmatrix';
import { Texture } from '../../../drawstruct';
import { State } from '../../../stategl';
import { BuildContext } from '../api';
import { BuildBuffer } from './buffers';
import { BufferRenderable, GRID, GridSetup, PointSpriteSetup, POINT_SPRITE, SOLID, SolidSetup, WIREFRAME, WireframeSetup } from './setups';

export enum Type {
  SURFACE,
  FACE
}

export interface Renderable {
  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void;
  reset(): void;
}

export const NULL_RENDERABLE: Renderable = {
  draw: (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => { },
  reset: () => { }
}

export class StateRenderable implements Renderable {
  constructor(readonly renderable: Renderable, readonly pred: (cts: BuildContext) => boolean) { }
  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void { if (this.pred(ctx)) this.renderable.draw(ctx, gl, state) }
  public reset() { this.renderable.reset() }
}

export function wrapState(state: string, rend: Renderable) {
  return new StateRenderable(rend, statePred(state));
}

export function wrapStatePred(pred: (cts: BuildContext) => boolean, rend: Renderable) {
  return new StateRenderable(rend, pred);
}

export function statePred(name: string): (cts: BuildContext) => boolean { return (ctx: BuildContext) => ctx.state.get(name) };
export function notStatePred(name: string): (cts: BuildContext) => boolean { return (ctx: BuildContext) => !ctx.state.get(name) };

export class RenderableList implements Renderable {
  constructor(
    private renderables: Iterable<Renderable>
  ) { }
  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void { for (let r of this.renderables) r.draw(ctx, gl, state) }
  public reset() { for (let r of this.renderables) r.reset() }
}

export interface SectorRenderable extends Renderable {
  ceiling: Renderable;
  floor: Renderable;
}

export interface WallRenderable extends Renderable {
  top: Renderable;
  mid: Renderable;
  bot: Renderable;
}

export interface BuildRenderableProvider {
  sector(id: number): SectorRenderable;
  wall(id: number): WallRenderable;
  wallPoint(id: number): Renderable;
  sprite(id: number): Renderable;
}


let color = GLM.vec4.create();
export class Solid extends BufferRenderable<SolidSetup> {
  readonly buff = new BuildBuffer();
  public type: Type = Type.SURFACE;
  public tex: Texture;
  public shade: number;
  public trans: number = 1;
  public pal: number;
  public parallax: number = 0;
  public texMat: GLM.Mat4Array = GLM.mat4.create();

  constructor() { super(SOLID) }

  public setup(ctx: BuildContext, setup: SolidSetup) {
    setup.shader(this.type == Type.SURFACE ? (this.parallax ? 'parallax' : 'baseShader') : 'spriteShader')
      .base(this.tex)
      .color(GLM.vec4.set(color, 1, 1, 1, this.trans))
      .pal(this.pal)
      .shade(this.shade);
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.trans = 1;
    this.parallax = 0;
    this.tex = null;
    this.shade = 0;
    this.pal = 0;
  }
}

export class WrapRenderable implements Renderable {
  constructor(
    private rend: Renderable,
    private pre: (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => void,
    private post: (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => void = () => { }
  ) { }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    this.pre(ctx, gl, state);
    this.rend.draw(ctx, gl, state);
    state.flush(gl);
    this.post(ctx, gl, state);
  }

  reset(): void {
    this.rend.reset()
  }
}

export class GridRenderable extends BufferRenderable<GridSetup> {
  public solid: Solid;
  public gridTexMatProvider: (scale: number) => GLM.Mat4Array;

  constructor() { super(GRID) }

  public get buff() { return this.solid.buff }
  public reset() { }

  public setup(ctx: BuildContext, setup: GridSetup) {
    setup.shader('grid')
      .grid(this.gridTexMatProvider(ctx.gridScale));
  }
}

export class PointSprite extends BufferRenderable<PointSpriteSetup> {
  readonly buff: BuildBuffer = new BuildBuffer();
  public tex: Texture;
  public color = GLM.vec4.fromValues(1, 1, 1, 1);

  constructor() { super(POINT_SPRITE) }

  public setup(ctx: BuildContext, setup: PointSpriteSetup) {
    setup.shader('spriteFaceShader')
      .base(this.tex)
      .color(this.color);
  }

  public reset() {
    this.buff.deallocate();
    this.tex = null;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}

export class Wireframe extends BufferRenderable<WireframeSetup> {
  readonly buff: BuildBuffer = new BuildBuffer();
  public type: Type = Type.SURFACE;
  public color = GLM.vec4.fromValues(1, 1, 1, 1);
  public mode = WebGLRenderingContext.LINES;

  constructor() { super(WIREFRAME) }

  public setup(ctx: BuildContext, setup: WireframeSetup) {
    setup.shader(this.type == Type.SURFACE ? 'baseFlatShader' : 'spriteFlatShader')
      .color(this.color);
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.mode = WebGLRenderingContext.LINES;
    vec4.set(this.color, 1, 1, 1, 1);
  }
}