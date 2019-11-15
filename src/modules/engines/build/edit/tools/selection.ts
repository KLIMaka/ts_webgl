import { detuple0, detuple1 } from "../../../../../libs/mathutils";
import { Deck } from "../../../../collections";
import { info, error } from "../../../../logger";
import { BuildContext } from "../../api";
import { closestWallSegmentInSector, insertSprite, loopWalls, nextwall } from "../../boardutils";
import { Context } from "../../gl/context";
import { BuildRenderableProvider } from "../../gl/renderable";
import { Message, MessageHandler, MessageHandlerList, MessageHandlerReflective } from "../../handlerapi";
import { Hitscan, isSector, isSprite, isWall, SubType } from "../../hitscan";
import { Board } from "../../structs";
import { sectorOfWall } from "../../utils";
import { getClosestSectorZ, getClosestWall, snap } from "../editutils";
import { MovingHandle } from "../handle";
import { EndMove, Highlight, Move, NamedMessage, Render, SetPicnum, Shade, StartMove, Frame } from "../messages";
import { SectorEnt } from "../sector";
import { SpriteEnt } from "../sprite";
import { WallEnt } from "../wall";
import { WallSegmentsEnt } from "../wallsegment";

export type PicNumCallback = (picnum: number) => void;
export type PicNumSelector = (cb: PicNumCallback) => void;

const handle = new MovingHandle();
const MOVE = new Move(0, 0, 0);
const START_MOVE = new StartMove();
const END_MOVE = new EndMove();
const SET_PICNUM = new SetPicnum(-1);
const HIGHLIGHT = new Highlight();


const MOVE_STATE = 'move';
const LOOP_STATE = 'select_loop_mod';
const SNAP_DIST = 'select.snap_dist';

export const MOVE_COPY = 'move.copy';
export const MOVE_VERTICAL = 'move.vertical';
export const MOVE_PARALLEL = 'move.parallel';
export const MOVE_ROTATE = 'move.rotate';

let clipboardPicnum = new SetPicnum(0);
let clipboardShade = new Shade(0, true);

function getAttachedSector(board: Board, hit: Hitscan): MessageHandler {
  let wall = board.walls[hit.id];
  let sectorId = wall.nextsector == -1 ? sectorOfWall(board, hit.id) : wall.nextsector;
  let type = getClosestSectorZ(board, sectorId, hit.x, hit.y, hit.z)[0];
  return SectorEnt.create(sectorId, type);
}

let list = new Deck<MessageHandler>();
let segment = new Deck<number>();
export function getFromHitscan(ctx: BuildContext): Deck<MessageHandler> {
  let hit = ctx.hitscan;
  let fullLoop = ctx.state.get<boolean>(LOOP_STATE);
  list.clear();
  let board = ctx.board;
  let w = getClosestWall(board, hit, ctx.state.get(SNAP_DIST), ctx.state.get('view_2d'));
  if (w != -1) {
    list.push(fullLoop ? WallSegmentsEnt.create(board, loopWalls(board, w, sectorOfWall(board, w))) : WallEnt.create(board, w));
  } else if (isWall(hit.type)) {
    wallSegment(fullLoop, board, hit.id, hit.type == SubType.LOWER_WALL);
  } else if (isSector(hit.type)) {
    let w = closestWallSegmentInSector(board, hit.id, hit.x, hit.y, ctx.state.get(SNAP_DIST));
    if (w != -1) wallSegment(fullLoop, board, w, hit.type == SubType.FLOOR); else sector(fullLoop, board, hit);
  } else if (isSprite(hit.type)) {
    list.push(SpriteEnt.create(hit.id));
  }
  return list;
}

function sector(fullLoop: boolean, board: Board, hit: Hitscan) {
  if (fullLoop) {
    let firstWall = board.sectors[hit.id].wallptr;
    list.push(WallSegmentsEnt.create(board, loopWalls(board, firstWall, hit.id)));
    list.push(SectorEnt.create(hit.id, hit.type == SubType.CEILING ? SubType.FLOOR : SubType.CEILING));
  }
  list.push(SectorEnt.create(hit.id, hit.type));
}

function wallSegment(fullLoop: boolean, board: Board, w: number, bottom: boolean) {
  if (fullLoop) {
    list.push(WallSegmentsEnt.create(board, loopWalls(board, w, sectorOfWall(board, w)), bottom));
  } else {
    let w1 = nextwall(board, w);
    segment.clear().push(w).push(w1);
    list.push(WallSegmentsEnt.create(board, segment, bottom));
  }
}


export class Selection extends MessageHandlerReflective {
  private selection = new MessageHandlerList();
  private valid = true;

  constructor(
    ctx: Context,
    private picnumSelector: PicNumSelector,
    private renderables: BuildRenderableProvider
  ) {
    super();

    ctx.state.register(MOVE_STATE, false);
    ctx.state.register(MOVE_COPY, false);
    ctx.state.register(MOVE_VERTICAL, false);
    ctx.state.register(MOVE_PARALLEL, false);
    ctx.state.register(MOVE_ROTATE, false);
    ctx.state.register(LOOP_STATE, false);
    ctx.state.register(SNAP_DIST, 32);
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    if (!handle.isActive()) this.selection.list().clear().pushAll(getFromHitscan(ctx));
    if (this.selection.list().isEmpty()) return;
    if (this.activeMove(ctx)) {
      this.updateHandle(ctx);
      try {
        this.updateMove(ctx);
      } catch (e) {
        this.valid = false;
        error(e);
      }
    }
  }

  public NamedMessage(msg: NamedMessage, ctx: BuildContext) {
    switch (msg.name) {
      case 'set_picnum': this.setTexture(ctx); ctx.commit(); return;
      case 'insert_sprite': this.insertSprite(ctx); ctx.commit(); return;
      case 'copy': this.copy(ctx); return;
      case 'paste_shade': this.selection.handle(clipboardShade, ctx); ctx.commit(); return;
      case 'paste_picnum': this.selection.handle(clipboardPicnum, ctx); ctx.commit(); return;
      case 'print_selected': this.print(ctx); return;
      default: this.selection.handle(msg, ctx);
    }
  }

  public handleDefault(msg: Message, ctx: BuildContext) {
    this.selection.handle(msg, ctx);
  }

  private activeMove(ctx: BuildContext) {
    let start = !handle.isActive() && ctx.state.get(MOVE_STATE);
    if (this.valid == false && start) this.valid = true;
    let move = handle.isActive() && ctx.state.get(MOVE_STATE);
    let end = handle.isActive() && !ctx.state.get(MOVE_STATE);
    return this.valid && (start || move || end);
  }

  private updateHandle(ctx: BuildContext) {
    let vertical = ctx.state.get<boolean>(MOVE_VERTICAL);
    let parallel = ctx.state.get<boolean>(MOVE_PARALLEL);
    let hit = ctx.hitscan;
    handle.update(vertical, parallel, hit);
  }

  private updateMove(ctx: BuildContext) {
    if (!handle.isActive() && ctx.state.get(MOVE_STATE)) {
      let hit = ctx.hitscan;
      handle.start(hit);
      this.selection.handle(START_MOVE, ctx);
    } else if (!ctx.state.get(MOVE_STATE)) {
      handle.stop();
      this.selection.handle(END_MOVE, ctx);
      ctx.commit();
      return;
    }

    MOVE.dx = handle.dx;
    MOVE.dy = handle.dy;
    MOVE.dz = handle.dz;
    this.selection.handle(MOVE, ctx);
  }

  private setTexture(ctx: BuildContext) {
    let sel = this.selection.clone();
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      SET_PICNUM.picnum = picnum;
      sel.handle(SET_PICNUM, ctx);
    })
  }

  private insertSprite(ctx: BuildContext) {
    let [x, y] = snap(ctx);
    let hit = ctx.hitscan;
    let z = hit.z;
    if (!isSector(hit.type)) return;
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      let spriteId = insertSprite(ctx.board, x, y, z);
      ctx.board.sprites[spriteId].picnum = picnum;
    });
  }

  private print(ctx: BuildContext) {
    let hit = ctx.hitscan;
    switch (hit.type) {
      case SubType.CEILING:
      case SubType.FLOOR:
        info(hit.id, ctx.board.sectors[hit.id]);
        break;
      case SubType.UPPER_WALL:
      case SubType.MID_WALL:
      case SubType.LOWER_WALL:
        info(hit.id, ctx.board.walls[hit.id]);
        break;
      case SubType.SPRITE:
        info(hit.id, ctx.board.sprites[hit.id]);
        break;
    }
  }

  private copy(ctx: BuildContext) {
    let hit = ctx.hitscan;
    if (hit.t == -1) return;
    switch (hit.type) {
      case SubType.CEILING:
        clipboardShade.value = ctx.board.sectors[hit.id].ceilingshade;
        clipboardPicnum.picnum = ctx.board.sectors[hit.id].ceilingpicnum;
        break;
      case SubType.FLOOR:
        clipboardShade.value = ctx.board.sectors[hit.id].floorshade;
        clipboardPicnum.picnum = ctx.board.sectors[hit.id].floorpicnum;
        break;
      case SubType.LOWER_WALL:
      case SubType.MID_WALL:
      case SubType.UPPER_WALL:
        clipboardShade.value = ctx.board.walls[hit.id].shade;
        clipboardPicnum.picnum = ctx.board.walls[hit.id].picnum;
        break;
      case SubType.SPRITE:
        clipboardShade.value = ctx.board.sprites[hit.id].shade;
        clipboardPicnum.picnum = ctx.board.sprites[hit.id].picnum;
        break;
    }
  }

  public Render(msg: Render, ctx: BuildContext) {
    HIGHLIGHT.set.clear();
    this.selection.handle(HIGHLIGHT, ctx);
    for (let v of HIGHLIGHT.set.keys()) {
      let type = detuple0(v);
      let id = detuple1(v);
      switch (type) {
        case 0: msg.list.push(this.renderables.sector(id).ceiling); break;
        case 1: msg.list.push(this.renderables.sector(id).floor); break;
        case 2: msg.list.push(this.renderables.wall(id)); break;
        case 3: msg.list.push(this.renderables.wallPoint(id)); break;
        case 4: msg.list.push(this.renderables.sprite(id)); break;
      }
    }
  }
}


