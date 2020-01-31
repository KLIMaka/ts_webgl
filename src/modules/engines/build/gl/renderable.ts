import * as GLM from '../../../../libs_js/glmatrix';
import * as PROFILE from '../../../profiler';
import { State, StateValue } from '../../../stategl';
import { BuildContext } from '../api';
import { BuildBuffer } from './buffers';
import { Texture, VertexBuffer } from '../../../drawstruct';

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
export class Solid implements Renderable {
  public type: Type = Type.SURFACE;
  public buff: BuildBuffer = new BuildBuffer();
  public tex: Texture;
  public shade: number;
  public trans: number = 1;
  public pal: number;
  public parallax: number = 0;
  public texMat: GLM.Mat4Array = GLM.mat4.create();

  private uniformsUpdated = false;
  private baseUniform: StateValue<Texture>;
  private colorUniform: StateValue<any>;
  private pluNUniform: StateValue<any>;
  private shadeUniform: StateValue<any>;
  private posBuffer: StateValue<VertexBuffer>;
  private normBuffer: StateValue<VertexBuffer>;
  private tcBuffer: StateValue<VertexBuffer>;

  private updateUniformLocations(state: State) {
    if (this.uniformsUpdated) return;
    this.baseUniform = state.getTextureValue('base');
    this.colorUniform = state.getUniformValue('color');
    this.pluNUniform = state.getUniformValue('pluN');
    this.shadeUniform = state.getUniformValue('shade');
    this.posBuffer = state.getVertexBufferValue('aPos');
    this.normBuffer = state.getVertexBufferValue('aNorm');
    this.tcBuffer = state.getVertexBufferValue('aTc');
    this.uniformsUpdated = true;
  }

  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State) {
    if (this.buff.getSize() == 0) return;
    this.updateUniformLocations(state);
    const buff = this.buff;
    state.setIndexBuffer(buff.getIdxBuffer());
    this.posBuffer.set(buff.getPosBuffer());
    this.normBuffer.set(buff.getNormBuffer());
    this.tcBuffer.set(buff.getTexCoordBuffer());
    state.setShader(this.type == Type.SURFACE ? (this.parallax ? 'parallax' : 'baseShader') : 'spriteShader');
    this.baseUniform.set(this.tex);
    this.colorUniform.set(GLM.vec4.set(color, 1, 1, 1, this.trans));
    this.pluNUniform.set(this.pal);
    this.shadeUniform.set(this.shade);
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
    this.uniformsUpdated = false;
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