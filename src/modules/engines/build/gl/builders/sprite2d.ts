import { vec3 } from "../../../../../libs_js/glmatrix";
import { BuildContext } from "../../api";
import { ang2vec, spriteAngle, ZSCALE } from "../../utils";
import { Wireframe } from "../renderable";

export function updateSpriteAngle(ctx: BuildContext, spriteId: number, renderable: Wireframe): Wireframe {
  if (renderable == null) renderable = new Wireframe();
  renderable.reset();
  renderable.mode = WebGLRenderingContext.TRIANGLES;
  let buff = renderable.buff;
  buff.allocate(3, 6);
  let spr = ctx.board.sprites[spriteId];
  let x = spr.x, y = spr.y, z = spr.z / ZSCALE;
  let ang = spriteAngle(spr.ang);
  let size = 128;
  let vec1 = ang2vec(ang);
  vec3.scale(vec1, vec1, size);
  let vec2 = ang2vec(ang + Math.PI / 2);
  vec3.scale(vec2, vec2, size / 4);
  buff.writePos(0, x + vec1[0], z, y + vec1[2]);
  buff.writePos(1, x + vec2[0], z, y + vec2[2]);
  buff.writePos(2, x - vec2[0], z, y - vec2[2]);
  buff.writeTriangle(0, 0, 1, 2);
  buff.writeTriangle(3, 2, 1, 0);
  return renderable;
}

export function updateSprite2d(ctx: BuildContext, sprId: number, renderable: Wireframe): Wireframe {
  // if (renderable != null) renderable.reset();
  // const sprite = ctx.board.sprites[sprId];
  // const label = text(sprId + "", sprite.x, sprite.y, sprite.z / ZSCALE, 8, 8, ctx.art.get(-2));
  // return new RenderableList([updateSpriteAngle(ctx, sprId, null), label]);
  return updateSpriteAngle(ctx, sprId, renderable);
}
