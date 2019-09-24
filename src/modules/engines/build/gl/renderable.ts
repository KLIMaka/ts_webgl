import * as GLM from '../../../../libs_js/glmatrix';
import { Pointer } from '../../../buffergl';
import * as DS from '../../../drawstruct';
import { State } from '../../../stategl';
import * as PROFILE from '../../../profiler';
import * as BUFF from './buffers';

export class Buffer {
  private ptr: Pointer;

  public get(): Pointer {
    return this.ptr;
  }

  public allocate(vtxCount: number, triIndexCount: number) {
    if (this.ptr != null) {
      if (this.ptr.vtx.size >= vtxCount && this.ptr.idx.size >= triIndexCount) return;
      BUFF.remove(this.ptr);
    }
    this.ptr = BUFF.allocate(vtxCount, triIndexCount);
  }

  public deallocate() {
    if (this.ptr != null) {
      BUFF.remove(this.ptr);
      this.ptr = null;
    }
  }

  public writePos(off: number, x: number, y: number, z: number): number {
    return BUFF.writePos(this.ptr, off, x, y, z);
  }

  public writeNormal(off: number, x: number, y: number, z: number): number {
    return BUFF.writeNormal(this.ptr, off, x, y, z);
  }

  public writeTc(off: number, u: number, v: number): number {
    return BUFF.writeTc(this.ptr, off, u, v);
  }

  public writeTriangle(off: number, a: number, b: number, c: number): number {
    return BUFF.writeTriangle(this.ptr, off, a, b, c);
  }

  public writeQuad(off: number, a: number, b: number, c: number, d: number): number {
    return BUFF.writeQuad(this.ptr, off, a, b, c, d);
  }

  public writeLine(off: number, a: number, b: number) {
    return BUFF.writeLine(this.ptr, off, a, b);
  }
}

export enum Type {
  SURFACE,
  FACE
}

export interface Renderable {
  draw(gl: WebGLRenderingContext, state: State): void;
  reset(): void;
}

export const NULL_RENDERABLE: Renderable = {
  draw: (gl: WebGLRenderingContext, state: State) => { },
  reset: () => { }
}

export class RenderableList implements Renderable {
  constructor(
    private renderables: Array<Renderable>
  ) { }

  public draw(gl: WebGLRenderingContext, state: State): void {
    for (let i = 0; i < this.renderables.length; i++) {
      this.renderables[i].draw(gl, state);
    }
  }

  public reset() {
    for (let i = 0; i < this.renderables.length; i++) {
      this.renderables[i].reset();
    }
  }
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
  public buff: Buffer = new Buffer();
  public tex: DS.Texture;
  public shade: number;
  public trans: number = 1;
  public pal: number;
  public parallax: number = 0;
  public texMat: GLM.Mat4Array = GLM.mat4.create();

  public draw(gl: WebGLRenderingContext, state: State) {
    if (!this.renderable()) return;
    let ptr = this.buff.get();
    state.setIndexBuffer(BUFF.getIdxBuffer(ptr));
    state.setVertexBuffer('aPos', BUFF.getPosBuffer(ptr));
    state.setVertexBuffer('aNorm', BUFF.getNormBuffer(ptr));
    state.setVertexBuffer('aTc', BUFF.getTexCoordBuffer(ptr));
    state.setShader(this.type == Type.SURFACE ? (this.parallax ? 'parallax' : 'baseShader') : 'spriteShader');
    state.setTexture('base', this.tex);
    state.setUniform('color', GLM.vec4.set(color, 1, 1, 1, this.trans));
    state.setUniform('pluN', this.pal);
    state.setUniform('shade', this.shade);
    state.setDrawElements(this.buff.get());
    state.draw(gl);
    PROFILE.get(null).inc('draws');
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.trans = 1;
    this.parallax = 0;
  }

  public renderable(): boolean {
    return this.buff.get() != null;
  }
}

export class GridRenderable implements Renderable {
  public solid: Solid;
  public gridTexMat: GLM.Mat4Array;

  public draw(gl: WebGLRenderingContext, state: State) {
    if (!this.renderable()) return;
    let ptr = this.solid.buff.get();
    state.setIndexBuffer(BUFF.getIdxBuffer(ptr));
    state.setVertexBuffer('aPos', BUFF.getPosBuffer(ptr));
    state.setVertexBuffer('aNorm', BUFF.getNormBuffer(ptr));
    state.setVertexBuffer('aTc', BUFF.getTexCoordBuffer(ptr));
    state.setShader('grid');
    state.setUniform('GT', this.gridTexMat);
    state.setDrawElements(this.solid.buff.get());
    state.draw(gl);
    PROFILE.get(null).inc('draws');
  }

  public renderable(): boolean {
    return this.solid.buff.get() != null;
  }

  public reset() {
  }
}

export class Wireframe implements Renderable {
  public type: Type = Type.SURFACE;
  public buff: Buffer = new Buffer();
  public mode: number = WebGLRenderingContext.LINES;
  public color = GLM.vec4.fromValues(1, 1, 1, 1);

  public draw(gl: WebGLRenderingContext, state: State) {
    if (!this.renderable()) return;
    let ptr = this.buff.get();
    state.setIndexBuffer(BUFF.getIdxBuffer(ptr));
    state.setVertexBuffer('aPos', BUFF.getPosBuffer(ptr));
    state.setVertexBuffer('aNorm', BUFF.getNormBuffer(ptr));
    state.setVertexBuffer('aTc', BUFF.getTexCoordBuffer(ptr));
    state.setShader(this.type == Type.SURFACE ? 'baseFlatShader' : 'spriteFlatShader');
    state.setUniform('color', this.color);
    state.setDrawElements(this.buff.get());
    state.draw(gl, this.mode);
    PROFILE.get(null).inc('draws');
  }

  public reset() {
    this.buff.deallocate();
    this.type = Type.SURFACE;
    this.mode = WebGLRenderingContext.LINES;
  }

  public renderable(): boolean {
    return this.buff.get() != null;
  }
}