import { vec3 } from "../../../../../libs_js/glmatrix";
import { BuildContext } from "../../api";
import { createSlopeCalculator, sectorOfWall, wallNormal } from "../../utils";
import { Solid } from "../renderable";

export class WallBuilder extends Solid {

}

let wallNormal_ = vec3.create();
export function updateWall(ctx: BuildContext, wallId: number, builder: WallBuilder) {
  const board = ctx.board;
  const art = ctx.art;
  const wall = board.walls[wallId];
  const sectorId = sectorOfWall(board, wallId);
  const sector = board.sectors[sectorId];
  const wall2 = board.walls[wall.point2];
  const x1 = wall.x; const y1 = wall.y;
  const x2 = wall2.x; const y2 = wall2.y;
  const tex = art.get(wall.picnum);
  const info = art.getInfo(wall.picnum);
  const slope = createSlopeCalculator(board, sectorId);
  const ceilingheinum = sector.ceilingheinum;
  const ceilingz = sector.ceilingz;
  const floorheinum = sector.floorheinum;
  const floorz = sector.floorz;
  const trans = (wall.cstat.translucent || wall.cstat.translucentReversed) ? 0.6 : 1;
  const normal = normals(wallNormal(wallNormal_, board, wallId));

  if (wall.nextwall == -1 || wall.cstat.oneWay) {
    let coords = getWallCoords(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
    let base = wall.cstat.alignBottom ? floorz : ceilingz;
    applyWallTextureTransform(wall, wall2, info, base, wall, builder.mid.texMat);
    genQuad(coords, normal, builder.mid.texMat, builder.mid.buff);
    builder.mid.tex = tex;
    builder.mid.shade = wall.shade;
    builder.mid.pal = wall.pal;
  } else {
    let nextsector = board.sectors[wall.nextsector];
    let nextslope = createSlopeCalculator(board, wall.nextsector);
    let nextfloorz = nextsector.floorz;
    let nextceilingz = nextsector.ceilingz;

    let nextfloorheinum = nextsector.floorheinum;
    let floorcoords = getWallCoords(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true);
    if (floorcoords != null) {
      if (sector.floorstat.parallaxing && nextsector.floorstat.parallaxing && sector.floorpicnum == nextsector.floorpicnum) {
        builder.bot.tex = art.getParallaxTexture(sector.floorpicnum);
        builder.bot.shade = sector.floorshade;
        builder.bot.pal = sector.floorpal;
        builder.bot.parallax = 1;
      } else {
        let wall_ = wall.cstat.swapBottoms ? board.walls[wall.nextwall] : wall;
        let wall2_ = wall.cstat.swapBottoms ? board.walls[wall_.point2] : wall2;
        let tex_ = wall.cstat.swapBottoms ? art.get(wall_.picnum) : tex;
        let info_ = wall.cstat.swapBottoms ? art.getInfo(wall_.picnum) : info;
        let base = wall.cstat.alignBottom ? ceilingz : nextfloorz;
        applyWallTextureTransform(wall_, wall2_, info_, base, wall, builder.bot.texMat);
        builder.bot.tex = tex_;
        builder.bot.shade = wall_.shade;
        builder.bot.pal = wall_.pal;
      }
      genQuad(floorcoords, normal, builder.bot.texMat, builder.bot.buff);
    }

    let nextceilingheinum = nextsector.ceilingheinum;
    let ceilcoords = getWallCoords(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true);
    if (ceilcoords != null) {
      if (sector.ceilingstat.parallaxing && nextsector.ceilingstat.parallaxing && sector.ceilingpicnum == nextsector.ceilingpicnum) {
        builder.top.tex = art.getParallaxTexture(sector.ceilingpicnum);
        builder.top.shade = sector.ceilingshade;
        builder.top.pal = sector.ceilingpal;
        builder.top.parallax = 1;
      } else {
        let base = wall.cstat.alignBottom ? ceilingz : nextceilingz;
        applyWallTextureTransform(wall, wall2, info, base, wall, builder.top.texMat);
        builder.top.tex = tex;
        builder.top.shade = wall.shade;
        builder.top.pal = wall.pal;
      }
      genQuad(ceilcoords, normal, builder.top.texMat, builder.top.buff);
    }

    if (wall.cstat.masking) {
      let tex1 = art.get(wall.overpicnum);
      let info1 = art.getInfo(wall.overpicnum);
      let coords = getMaskedWallCoords(x1, y1, x2, y2, slope, nextslope,
        ceilingheinum, nextceilingheinum, ceilingz, nextceilingz,
        floorheinum, nextfloorheinum, floorz, nextfloorz);
      let base = wall.cstat.alignBottom ? Math.min(floorz, nextfloorz) : Math.max(ceilingz, nextceilingz);
      applyWallTextureTransform(wall, wall2, info1, base, wall, builder.mid.texMat);
      genQuad(coords, normal, builder.mid.texMat, builder.mid.buff);
      builder.mid.tex = tex1;
      builder.mid.shade = wall.shade;
      builder.mid.pal = wall.pal;
      builder.mid.trans = trans;
    }
  }
}