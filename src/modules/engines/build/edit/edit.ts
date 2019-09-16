import { Deck, Collection } from "../../../deck";
import { nextwall, loopWalls } from "../boardutils";
import { Hitscan, isSector, isSprite, isWall, SubType } from "../hitscan";
import { MessageHandler } from "../messages";
import { Board } from "../structs";
import { sectorOfWall } from "../utils";
import { EndMove, Highlight, Move, StartMove, BuildContext, SetPicnum, ToggleParallax, Shade, PanRepeat, Palette, Flip, SpriteMode } from "./editapi";
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
export const MOVE = new Move(handle);
export const START_MOVE = new StartMove(handle);
export const END_MOVE = new EndMove(handle);
export const HIGHLIGHT = new Highlight();
export const SET_PICNUM = new SetPicnum(-1);
export const TOGGLE_PARALLAX = new ToggleParallax();
export const SHADE_CHANGE = new Shade(0);
export const PANREPEAT = new PanRepeat(0, 0, 0, 0);
export const RESET_PANREPEAT = new PanRepeat(0, 0, 0, 0, true);
export const PALETTE = new Palette(1, 14);
export const FLIP = new Flip();
export const SPRITE_MODE = new SpriteMode();

// Tools
export const SPLIT_WALL = new SplitWall();
export const DRAW_SECTOR = new DrawSector();
export const JOIN_SECTORS = new JoinSectors();

function getAttachedSector(board: Board, hit: Hitscan): MessageHandler {
  let wall = board.walls[hit.id];
  let sectorId = wall.nextsector == -1 ? sectorOfWall(board, hit.id) : wall.nextsector;
  let type = getClosestSectorZ(board, sectorId, hit.x, hit.y, hit.z)[0];
  return SectorEnt.create(sectorId, type);
}

let list = new Deck<MessageHandler>();
let segment = new Deck<number>();
export function getFromHitscan(board: Board, hit: Hitscan, ctx: BuildContext, fullLoop = false): Deck<MessageHandler> {
  list.clear();
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
