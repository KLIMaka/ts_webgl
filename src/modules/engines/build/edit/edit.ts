import { Deck } from "../../../deck";
import { BuildContext } from "../api";
import { loopWalls, nextwall } from "../boardutils";
import { Hitscan, isSector, isSprite, isWall, SubType } from "../hitscan";
import { MessageHandler } from "../messages";
import { Board } from "../structs";
import { sectorOfWall } from "../utils";
import { getClosestSectorZ, getClosestWall } from "./editutils";
import { SectorEnt } from "./sector";
import { SpriteEnt } from "./sprite";
import { WallEnt } from "./wall";
import { WallSegmentsEnt } from "./wallsegment";

function getAttachedSector(board: Board, hit: Hitscan): MessageHandler {
  let wall = board.walls[hit.id];
  let sectorId = wall.nextsector == -1 ? sectorOfWall(board, hit.id) : wall.nextsector;
  let type = getClosestSectorZ(board, sectorId, hit.x, hit.y, hit.z)[0];
  return SectorEnt.create(sectorId, type);
}

let list = new Deck<MessageHandler>();
let segment = new Deck<number>();
export function getFromHitscan(ctx: BuildContext, hit: Hitscan, fullLoop = false): Deck<MessageHandler> {
  list.clear();
  let board = ctx.board;
  let w = getClosestWall(board, hit, ctx);
  if (w != -1) {
    list.push(fullLoop ? WallSegmentsEnt.create(board, loopWalls(board, w, sectorOfWall(board, w))) : WallEnt.create(board, w));
  } else if (isWall(hit.type)) {
    if (fullLoop) {
      list.push(WallSegmentsEnt.create(board, loopWalls(board, hit.id, sectorOfWall(board, hit.id))));
    } else {
      let w1 = nextwall(board, hit.id);
      segment.clear().push(hit.id).push(w1);
      list.push(WallSegmentsEnt.create(board, segment));
    }
  } else if (isSector(hit.type)) {
    if (fullLoop) {
      let firstWall = board.sectors[hit.id].wallptr;
      list.push(WallSegmentsEnt.create(board, loopWalls(board, firstWall, hit.id)));
      list.push(SectorEnt.create(hit.id, hit.type == SubType.CEILING ? SubType.FLOOR : SubType.CEILING));
    }
    list.push(SectorEnt.create(hit.id, hit.type));
  } else if (isSprite(hit.type)) {
    list.push(SpriteEnt.create(hit.id));
  }
  return list;
}
