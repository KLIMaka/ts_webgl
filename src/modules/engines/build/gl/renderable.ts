import * as GLM from '../../../../libs_js/glmatrix';
import * as PROFILE from '../../../profiler';
import { State, StateValue } from '../../../stategl';
import { BuildContext } from '../api';
import { BuildBuffer } from './buffers';
import { Texture, VertexBuffer, IndexBuffer } from '../../../drawstruct';
import { Deck } from '../../../collections';

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

class StateSetup {
  protected values = new Deck<any>();

  public apply(state: State) {
    state.setup(this.values);
  }

  protected register(name: string, state: State) {
    this.values.push(state.getState(name));
    this.values.push(null);
  }
}

class GeneralSetup extends StateSetup {
  constructor(state: State) {
    super();
    this.register('shader', state);
    this.register('aIndex', state);
    this.register('aPos', state);
    this.register('aNorm', state);
    this.register('aTc', state);
    this.register('base', state);
    this.register('color', state);
    this.register('pluN', state);
    this.register('shade', state);
  }

  public shader(shader: string) { this.values.set(1, shader); return this }
  public index(index: IndexBuffer) { this.values.set(3, index); return this }
  public position(pos: VertexBuffer) { this.values.set(5, pos); return this }
  public normal(norm: VertexBuffer) { this.values.set(7, norm); return this }
  public tc(tc: VertexBuffer) { this.values.set(9, tc); return this }
  public base(tex: Texture) { this.values.set(11, tex); return this }
  public color(color: GLM.Vec4Array) { this.values.set(13, color); return this }
  public pal(pal: number) { this.values.set(15, pal); return this }
  public shade(shade: number) { this.values.set(17, shade); return this }
}

let solidSetup: GeneralSetup = null;
function getSolidSetup(state: State) {
  if (solidSetup == null) solidSetup = new GeneralSetup(state);
  return solidSetup;
}

let color = GLM.vec4.create();
export class Solid implements Renderable {
  public type: Type = Type.SURFACE;
  public buff: BuildBuffer = new BuildBuffer();
  public tex: Texture;
  public shade: number;
  public trans: number = 1;
  public pal: number;
  public parallax: number = 0;
  public texMat: GLM.Mat4Array = GLM.mat4.create();

  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State) {
    if (this.buff.getSize() == 0) return;
    const buff = this.buff;
    getSolidSetup(state)
      .shader(this.type == Type.SURFACE ? (this.parallax ? 'parallax' : 'baseShader') : 'spriteShader')
      .index(buff.getIdxBuffer())
      .position(buff.getPosBuffer())
      .normal(buff.getNormBuffer())
      .tc(buff.getTexCoordBuffer())
      .base(this.tex)
      .color(GLM.vec4.set(color, 1, 1, 1, this.trans))
      .pal(this.pal)
      .shade(this.shade)
      .apply(state);
    state.setDrawElements(this.buff.get().buffer, this.buff.get().idx.offset, this.buff.getSize());
    if (state.draw(gl))
      PROFILE.get(null).inc('skip_draws');
    PROFILE.get(null).inc('draws');
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.trans = 1;
    this.parallax = 0;
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

export class GridRenderable implements Renderable {
  public solid: Solid;
  public gridTexMatProvider: (scale: number) => GLM.Mat4Array;

  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State) {
    if (!this.renderable()) return;
    const buff = this.solid.buff;
    state.setIndexBuffer(buff.getIdxBuffer());
    state.setVertexBuffer('aPos', buff.getPosBuffer());
    state.setVertexBuffer('aNorm', buff.getNormBuffer());
    state.setVertexBuffer('aTc', buff.getTexCoordBuffer());
    state.setShader('grid');
    state.setUniform('GT', this.gridTexMatProvider(ctx.gridScale));
    state.setDrawElements(this.solid.buff.get().buffer, this.solid.buff.get().idx.offset, this.solid.buff.getSize());
    if (state.draw(gl))
      PROFILE.get(null).inc('skip_draws');
    PROFILE.get(null).inc('draws');
  }

  public renderable(): boolean {
    return this.solid.buff.getSize() != 0;
  }

  public reset() {
  }
}

export class PointSprite implements Renderable {
  public buff: BuildBuffer = new BuildBuffer();
  public tex: Texture;
  public color = GLM.vec4.fromValues(1, 1, 1, 1);;

  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State) {
    if (this.buff.getSize() == 0) return;
    const buff = this.buff;
    state.setIndexBuffer(buff.getIdxBuffer());
    state.setVertexBuffer('aPos', buff.getPosBuffer());
    state.setVertexBuffer('aNorm', buff.getNormBuffer());
    state.setVertexBuffer('aTc', buff.getTexCoordBuffer());
    state.setShader('spriteFaceShader');
    state.setTexture('base', this.tex);
    state.setUniform('color', this.color);
    state.setDrawElements(this.buff.get().buffer, this.buff.get().idx.offset, this.buff.getSize());
    if (state.draw(gl, gl.TRIANGLES))
      PROFILE.get(null).inc('skip_draws');
    PROFILE.get(null).inc('draws');
  }

  public reset() {
    this.buff.deallocate();
  }
}

export class Wireframe implements Renderable {
  public type: Type = Type.SURFACE;
  public buff: BuildBuffer = new BuildBuffer();
  public mode: number = WebGLRenderingContext.LINES;
  public color = GLM.vec4.fromValues(1, 1, 1, 1);

  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State) {
    if (!this.renderable()) return;
    const buff = this.buff;
    state.setIndexBuffer(buff.getIdxBuffer());
    state.setVertexBuffer('aPos', buff.getPosBuffer());
    state.setVertexBuffer('aNorm', buff.getNormBuffer());
    state.setVertexBuffer('aTc', buff.getTexCoordBuffer());
    state.setShader(this.type == Type.SURFACE ? 'baseFlatShader' : 'spriteFlatShader');
    state.setUniform('color', this.color);
    state.setDrawElements(this.buff.get().buffer, this.buff.get().idx.offset, this.buff.getSize());
    if (state.draw(gl, this.mode))
      PROFILE.get(null).inc('skip_draws');
    PROFILE.get(null).inc('draws');
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.mode = WebGLRenderingContext.LINES;
  }

  public renderable(): boolean {
    return this.buff.getSize() != 0;
  }
}