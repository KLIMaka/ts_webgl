import { Wireframe } from "../renderable";

export class SpriteHelperBuillder extends Builders {
  constructor(
    readonly wire = new Wireframe(),
    readonly angle = new Wireframe()
  ) { super([wire, angle]) }
}

export function updateSpriteHelper(sprId: number, renderable: Renderable): Renderable {
  if (renderable != null) renderable.reset();
  let list = new Array<Renderable>();
  list.push(updateSpriteWireframe(this.ctx, sprId));
  list.push(updateSpriteAngle(this.ctx, sprId, null));
  return new RenderableList(list);
}