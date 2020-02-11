import { vec4, Mat4Array, mat4 } from '../../../../libs_js/glmatrix';
import { Texture } from '../../../drawstruct';
import { State } from '../../../stategl';
import { BuildContext } from '../api';
import { BuildBuffer } from './buffers';
import { BufferRenderable, GRID, GridSetup, PointSpriteSetup, POINT_SPRITE, SOLID, SolidSetup, WIREFRAME, WireframeSetup } from './setups';
import { FastIterable } from '../../../collections';

export enum Type {
  SURFACE,
  FACE
}

export interface Renderable {
  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void;
}

export const NULL_RENDERABLE: Renderable = {
  draw: (ctx: BuildContext, gl: WebGLRenderingContext, state: State) => { },
}

export class Renderables implements Renderable {
  constructor(private renderables: FastIterable<Renderable>) { }
  public draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    const size = this.renderables.size;
    const array = this.renderables.array;
    for (let i = 0; i < size; i++) array[i].draw(ctx, gl, state)
  }
}

export interface SectorRenderable extends Renderable {
  readonly ceiling: Renderable;
  readonly floor: Renderable;
}

export interface WallRenderable extends Renderable {
  readonly top: Renderable;
  readonly mid: Renderable;
  readonly bot: Renderable;
}

export interface BuildRenderableProvider {
  sector(id: number): SectorRenderable;
  wall(id: number): WallRenderable;
  wallPoint(id: number): Renderable;
  sprite(id: number): Renderable;
}


let color = vec4.create();
export class SolidBuilder extends BufferRenderable<SolidSetup> {
  readonly buff = new BuildBuffer();
  public type: Type = Type.SURFACE;
  public tex: Texture;
  public shade: number;
  public trans: number = 1;
  public pal: number;
  public parallax: number = 0;
  public texMat: Mat4Array = mat4.create();

  constructor() { super(SOLID) }

  public setup(ctx: BuildContext, setup: SolidSetup) {
    setup.shader(this.type == Type.SURFACE ? (this.parallax ? 'parallax' : 'baseShader') : 'spriteShader')
      .base(this.tex)
      .color(vec4.set(color, 1, 1, 1, this.trans))
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
}

export class GridRenderable extends BufferRenderable<GridSetup> {
  public solid: SolidBuilder;
  public gridTexMatProvider: (scale: number) => Mat4Array;

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
  public color = vec4.fromValues(1, 1, 1, 1);

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
  public color = vec4.fromValues(1, 1, 1, 1);
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