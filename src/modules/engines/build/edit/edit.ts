import { Deck } from "../../../deck";
import { nextwall } from "../boardutils";
import { Hitscan, isSector, isSprite, isWall } from "../hitscan";
import { MessageHandler } from "../messages";
import { Board } from "../structs";
import { sectorOfWall } from "../utils";
import { EndMove, Highlight, Move, StartMove, BuildContext, SetPicnum } from "./editapi";
import { getClosestSectorZ, getClosestWall } from "./editutils";
import { MovingHandle } from "./handle";
import { SectorEnt } from "./sector";
import { SpriteEnt } from "./sprite";
import { DrawSector } from "./tools/drawsector";
import { SplitWall } from "./tools/splitwall";
import { WallEnt } from "./wall";
import { WallSegmentsEnt } from "./wallsegment";
import { JoinSectors } from "./tools/joinsectors";

// Messages
let handle = new MovingHandle();
export let MOVE = new Move(handle);
export let START_MOVE = new StartMove(handle);
export let END_MOVE = new EndMove(handle);
export let HIGHLIGHT = new Highlight();
export let SET_PICNUM = new SetPicnum(-1);

// Tools
export let SPLIT_WALL = new SplitWall();
export let DRAW_SECTOR = new DrawSector();
export let JOIN_SECTORS = new JoinSectors();

function getAttachedSector(board: Board, hit: Hitscan): MessageHandler {
  let wall = board.walls[hit.id];
  let sectorId = wall.nextsector == -1 ? sectorOfWall(board, hit.id) : wall.nextsector;
  let type = getClosestSectorZ(board, sectorId, hit.x, hit.y, hit.z)[0];
  return SectorEnt.create(sectorId, type);
}

let list = new Deck<MessageHandler>();
let segment = new Deck<number>();
export function getFromHitscan(board: Board, hit: Hitscan, ctx: BuildContext): Deck<MessageHandler> {
  list.clear();
  let w = getClosestWall(board, hit, ctx);
  if (w != -1) {
    list.push(WallEnt.create(board, w));
    list.push(getAttachedSector(board, hit))
  } else if (isWall(hit.type)) {
    let w1 = nextwall(board, hit.id);
    segment.clear().push(hit.id).push(w1);
    list.push(WallSegmentsEnt.create(board, segment));
    list.push(getAttachedSector(board, hit))
  } else if (isSector(hit.type)) {
    list.push(SectorEnt.create(hit.id, hit.type));
  } else if (isSprite(hit.type)) {
    list.push(SpriteEnt.create(hit.id));
  }
  return list;
}
