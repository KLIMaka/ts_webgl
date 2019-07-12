import { Sprite, Board } from "./structs";
import { BloodSprite } from "./bloodstructs";
import { RorLinks, RorLink } from "./gl/boardrenderer";

export const MIRROR_PIC = 504;

function isUpperLink(spr: Sprite) {
  return spr.lotag == 11 || spr.lotag == 7 || spr.lotag == 9 || spr.lotag == 13;
}

function isLowerLink(spr: Sprite) {
  return spr.lotag == 12 || spr.lotag == 6 || spr.lotag == 10 || spr.lotag == 14;
}

export function loadRorLinks(board: Board): RorLinks {
  let linkRegistry = {};
  for (let s = 0; s < board.numsprites; s++) {
    let spr = board.sprites[s];
    if (isUpperLink(spr) || isLowerLink(spr)) {
      let id = (<BloodSprite>spr).extraData.data1;
      let links = linkRegistry[id];
      if (links == undefined) {
        links = [];
        linkRegistry[id] = links;
      }
      links.push(s);
    }
  }

  let links = new RorLinks();
  for (let linkId in linkRegistry) {
    let spriteIds = linkRegistry[linkId];
    if (spriteIds.length != 2)
      throw new Error('Invalid link in sprites: ' + spriteIds);
    let [s1, s2] = spriteIds;
    let spr1 = board.sprites[s1];
    let spr2 = board.sprites[s2];
    if (!isUpperLink(spr1)) {
      [s1, s2] = [s2, s1];
      [spr1, spr2] = [spr2, spr1];
    }
    if (board.sectors[spr1.sectnum].floorpicnum == MIRROR_PIC)
      links.floorLinks[spr1.sectnum] = new RorLink(s1, s2);
    if (board.sectors[spr2.sectnum].ceilingpicnum == MIRROR_PIC)
      links.ceilLinks[spr2.sectnum] = new RorLink(s2, s1);
  }
  return links;
}