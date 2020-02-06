import { Deck } from "../../../collections";
import { State } from "../../../stategl";
import { BuildBuffer } from "./buffers";
import { Texture } from "../../../drawstruct";
import { Buffer } from "../../../buffergl";
import * as PROFILE from '../../../profiler';
import { BuildContext } from "../api";
import { Vec4Array, Mat4Array } from "../../../../libs_js/glmatrix";
import { Renderable } from "./renderable";

export class StateSetup {
  protected values = new Deck<any>();
  protected buff: Buffer;
  protected offset: number;
  protected size: number;

  public apply(state: State) {
    state.setup(this.values);
    state.setDrawElements(this.buff, this.offset, this.size);
  }

  protected register(name: string, state: State) {
    this.values.push(state.getState(name));
    this.values.push(null);
  }
}

export class BufferSetup extends StateSetup {
  constructor(state: State) {
    super();
    this.register('shader', state);
    this.register('aIndex', state);
    this.register('aPos', state);
    this.register('aNorm', state);
    this.register('aTc', state);
  }

  public shader(shader: string) { this.values.set(1, shader); return this }

  public buffer(buffer: BuildBuffer) {
    this.values.set(3, buffer.getIdxBuffer());
    this.values.set(5, buffer.getPosBuffer());
    this.values.set(7, buffer.getNormBuffer());
    this.values.set(9, buffer.getTexCoordBuffer());
    this.buff = buffer.get().buffer;
    this.offset = buffer.get().idx.offset;
    this.size = buffer.getSize();
    return this;
  }
}

export class SolidSetup extends BufferSetup {
  constructor(state: State) {
    super(state);
    this.register('base', state);
    this.register('color', state);
    this.register('pluN', state);
    this.register('shade', state);
  }

  public base(tex: Texture) { this.values.set(11, tex); return this }
  public color(color: Vec4Array) { this.values.set(13, color); return this }
  public pal(pal: number) { this.values.set(15, pal); return this }
  public shade(shade: number) { this.values.set(17, shade); return this }
}

export class GridSetup extends BufferSetup {
  constructor(state: State) {
    super(state);
    this.register('GT', state);
  }

  public grid(grid: Mat4Array) { this.values.set(11, grid); return this }
}

export class WireframeSetup extends BufferSetup {
  constructor(state: State) {
    super(state);
    this.register('color', state);
  }

  public color(color: Vec4Array) { this.values.set(11, color); return this }
}

export class PointSpriteSetup extends BufferSetup {
  constructor(state: State) {
    super(state);
    this.register('base', state);
    this.register('color', state);
  }

  public base(tex: Texture) { this.values.set(11, tex); return this }
  public color(color: Vec4Array) { this.values.set(13, color); return this }
}

export abstract class BufferRenderable<T extends BufferSetup> implements Renderable {
  abstract readonly buff: BuildBuffer;
  public mode: number = WebGLRenderingContext.TRIANGLES;

  constructor(private getSetup: (state: State) => T) { }

  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State): void {
    if (this.buff.getSize() == 0) return;
    const setup = this.getSetup(state);
    setup.buffer(this.buff);
    this.setup(ctx, setup);
    setup.apply(state);
    if (state.draw(gl, this.mode))
      PROFILE.get(null).inc('skip_draws');
    PROFILE.get(null).inc('draws');
  }

  abstract setup(ctx: BuildContext, setup: T): void;
  abstract reset(): void;

  public quad(q: number[]) {
    const buff = this.buff;
    buff.writePos(0, q[0], q[2], q[1]);
    buff.writePos(1, q[3], q[5], q[4]);
    buff.writePos(2, q[6], q[8], q[7]);
    buff.writePos(3, q[9], q[11], q[10]);
  }
}

export function lazySingletonTransformer<I, O>(trans: (i: I) => O) {
  let instance: O = null;
  return (i: I) => {
    if (instance == null) instance = trans(i);
    return instance;
  }
}

export const SOLID = lazySingletonTransformer((state: State) => new SolidSetup(state));
export const GRID = lazySingletonTransformer((state: State) => new GridSetup(state));
export const POINT_SPRITE = lazySingletonTransformer((state: State) => new PointSpriteSetup(state));
export const WIREFRAME = lazySingletonTransformer((state: State) => new WireframeSetup(state));