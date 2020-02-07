import { Renderable } from "../renderable";
import { BuildContext } from "../../api";
import { State } from "../../../../stategl";

export interface Builder {
  reset(): void;
  get(): Renderable;
}

export class Builders implements Builder, Renderable {
  constructor(private builders: Iterable<Builder>) { }
  reset() { for (const b of this.builders) b.reset() }
  get() { return this }
  draw(ctx: BuildContext, gl: WebGLRenderingContext, state: State) { for (const b of this.builders) b.get().draw(ctx, gl, state) }
}