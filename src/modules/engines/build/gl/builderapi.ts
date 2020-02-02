import { Renderable } from "./renderable";
import { BuildContext } from "../api";

export type RenderableAcceptor = (r: Renderable) => void;

export interface Builder {
  reset(): void;
  collect(ctx: BuildContext, a: RenderableAcceptor): void;
}

export class Builders implements Builder {
  constructor(private builders: Iterable<Builder>) { }
  reset() { for (const b of this.builders) b.reset() }
  collect(ctx: BuildContext, a: RenderableAcceptor) { for (const b of this.builders) b.collect(ctx, a) }
}