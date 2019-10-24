import { detuple0, detuple1 } from "../../../../../libs/mathutils";
import { Deck } from "../../../../deck";
import { info } from "../../../../logger";
import { Frame } from "../../../idtech/md2structs";
import { BuildContext } from "../../api";
import { closestWallLineInSector, insertSprite, loopWalls, nextwall } from "../../boardutils";
import { Context } from "../../gl/context";
import { BuildRenderableProvider } from "../../gl/renderable";
import { MessageHandler, MessageHandlerList, MessageHandlerReflective } from "../../handlerapi";
import { Hitscan, isSector, isSprite, isWall, SubType } from "../../hitscan";
import { Board } from "../../structs";
import { sectorOfWall } from "../../utils";
import { getClosestSectorZ, getClosestWall, snap } from "../editutils";
import { MovingHandle } from "../handle";
import { EndMove, EventBus, Flip, Highlight, Move, Palette, PanRepeat, Render, SetPicnum, SetWallCstat, Shade, SpriteMode, StartMove, ToggleParallax } from "../messages";
import { SectorEnt } from "../sector";
import { SpriteEnt } from "../sprite";
import { WallEnt } from "../wall";
import { WallSegmentsEnt } from "../wallsegment";
import { multistringEventConsumer, StringEvent, MessageEvent } from "../../events";

export type PicNumCallback = (picnum: number) => void;
export type PicNumSelector = (cb: PicNumCallback) => void;

let handle = new MovingHandle();
const MOVE = new Move(handle);
const START_MOVE = new StartMove(handle);
const END_MOVE = new EndMove(handle);
const SET_PICNUM = new SetPicnum(-1);
const TOGGLE_PARALLAX = new ToggleParallax();
const SHADE_CHANGE = new Shade(0);
const PANREPEAT = new PanRepeat(0, 0, 0, 0);
const RESET_PANREPEAT = new PanRepeat(0, 0, 0, 0, true);
const PALETTE = new Palette(1, 14);
const FLIP = new Flip();
const SPRITE_MODE = new SpriteMode();
const HIGHLIGHT = new Highlight();
const SWAP_BOTTOMS = new SetWallCstat('swapBottoms');
const ALIGN_BOTTOM = new SetWallCstat('alignBottom');

const SNAP_RANGE = 16;
const PAN_SCALE = 8;
const SHADOW_SCALE = 8;

const MOVE_STATE = 'move';
const MOD1_STATE = 'mod1';
const MOD2_STATE = 'mod2';
const MOD3_STATE = 'mod3';
const LOOP_STATE = 'select_loop_mod';

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
export function getFromHitscan(ctx: BuildContext, hit: Hitscan): Deck<MessageHandler> {
  let fullLoop = ctx.state.get<boolean>(LOOP_STATE);
  list.clear();
  let board = ctx.board;
  let w = getClosestWall(board, hit, SNAP_RANGE);
  if (w != -1) {
    list.push(fullLoop ? WallSegmentsEnt.create(board, loopWalls(board, w, sectorOfWall(board, w))) : WallEnt.create(board, w));
  } else if (isWall(hit.type)) {
    wallSegment(fullLoop, board, hit.id, hit.type == SubType.LOWER_WALL);
  } else if (isSector(hit.type)) {
    let w = closestWallLineInSector(board, hit.id, hit.x, hit.y, SNAP_RANGE);
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

  constructor(
    ctx: Context,
    private picnumSelector: PicNumSelector,
    private renderables: BuildRenderableProvider
  ) {
    super();
    ctx.state.register(MOVE_STATE, false);
    ctx.state.register(MOD1_STATE, false);
    ctx.state.register(MOD2_STATE, false);
    ctx.state.register(MOD3_STATE, false);
    ctx.state.register(LOOP_STATE, false);
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    if (!handle.isActive()) this.selection.list().clear().pushAll(getFromHitscan(ctx, ctx.state.get<Hitscan>('hitscan')));
    if (this.selection.list().isEmpty()) return;
    if (this.activeMove(ctx)) {
      this.updateHandle(ctx);
      this.updateMove(ctx);
    }
  }

  private eventConsumer = (e: Event, ctx: BuildContext) => {
    if (e instanceof StringEvent) {
      switch (e.name) {
        case 'set_picnum': this.setTexture(ctx); return true;
        case 'toggle_parallax': this.selection.handle(TOGGLE_PARALLAX, ctx); return true;
        case 'repeat_y_scaled+': this.sendRepeat(ctx, 0, PAN_SCALE); return true;
        case 'repeat_y_scaled-': this.sendRepeat(ctx, 0, -PAN_SCALE); return true;
        case 'repeat_x_scaled-': this.sendRepeat(ctx, -PAN_SCALE, 0); return true;
        case 'repeat_x_scaled+': this.sendRepeat(ctx, PAN_SCALE, 0); return true;
        case 'repeat_y+': this.sendRepeat(ctx, 0, 1); return true;
        case 'repeat_y-': this.sendRepeat(ctx, 0, -1); return true;
        case 'repeat_x-': this.sendRepeat(ctx, -1, 0); return true;
        case 'repeat_x+': this.sendRepeat(ctx, 1, 0); return true;
        case 'pan_y_scaled+': this.sendPan(ctx, 0, PAN_SCALE); return true;
        case 'pan_y_scaled-': this.sendPan(ctx, 0, -PAN_SCALE); return true;
        case 'pan_x_scaled-': this.sendPan(ctx, -PAN_SCALE, 0); return true;
        case 'pan_x_scaled+': this.sendPan(ctx, PAN_SCALE, 0); return true;
        case 'pan_y+': this.sendPan(ctx, 0, 1); return true;
        case 'pan_y-': this.sendPan(ctx, 0, -1); return true;
        case 'pan_x-': this.sendPan(ctx, -1, 0); return true;
        case 'pan_x+': this.sendPan(ctx, 1, 0); return true;
        case 'cycle_pal': this.selection.handle(PALETTE, ctx); return true;
        case 'flip': this.selection.handle(FLIP, ctx); return true;
        case 'insert_sprite': this.insertSprite(ctx); return true;
        case 'swap_bottoms': this.selection.handle(SWAP_BOTTOMS, ctx); return true;
        case 'align_bottom': this.selection.handle(ALIGN_BOTTOM, ctx); return true;
        case 'sprite_mode': this.selection.handle(SPRITE_MODE, ctx); return true;
        case 'copy': this.copy(ctx); return true;
        case 'paste_shade': this.selection.handle(clipboardShade, ctx); return true;
        case 'paste_picnum': this.selection.handle(clipboardPicnum, ctx); return true;
        case 'shade+': this.sendShadeChange(1, ctx); return true;
        case 'shade-': this.sendShadeChange(-1, ctx); return true;
        case 'shade_scaled+': this.sendShadeChange(SHADOW_SCALE, ctx); return true;
        case 'shade_scaled-': this.sendShadeChange(-SHADOW_SCALE, ctx); return true;
        case 'print_selected': this.print(ctx); return true;
        default: return false;
      }
    } else if (e instanceof MessageEvent) {
      this.selection.handle(e.message, ctx);
    }
  };

  public EventBus(msg: EventBus, ctx: BuildContext) {
    msg.events.tryConsume(this.eventConsumer, ctx);
  }

  private activeMove(ctx: BuildContext) {
    let start = !handle.isActive() && ctx.state.get(MOVE_STATE);
    let move = handle.isActive() && ctx.state.get(MOVE_STATE);
    let end = handle.isActive() && !ctx.state.get(MOVE_STATE);
    return start || move || end;
  }

  private updateHandle(ctx: BuildContext) {
    let mod1 = ctx.state.get<boolean>(MOD1_STATE);
    let mod2 = ctx.state.get<boolean>(MOD2_STATE);
    let mod3 = ctx.state.get<boolean>(MOD3_STATE);
    let hit = ctx.state.get<Hitscan>('hitscan');
    handle.update(mod1, mod2, mod3, hit);
  }

  private updateMove(ctx: BuildContext) {
    if (!handle.isActive() && ctx.state.get(MOVE_STATE)) {
      let hit = ctx.state.get<Hitscan>('hitscan');
      handle.start(hit);
      this.selection.handle(START_MOVE, ctx);
    } else if (!ctx.state.get(MOVE_STATE)) {
      handle.stop();
      this.selection.handle(END_MOVE, ctx);
      return;
    }

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

  private sendShadeChange(change: number, ctx: BuildContext) {
    SHADE_CHANGE.value = change;
    this.selection.handle(SHADE_CHANGE, ctx);
  }

  private sendPan(ctx: BuildContext, x: number, y: number) {
    PANREPEAT.xrepeat = PANREPEAT.yrepeat = 0;
    PANREPEAT.xpan = x;
    PANREPEAT.ypan = y;
    this.selection.handle(PANREPEAT, ctx);
  }

  private sendRepeat(ctx: BuildContext, x: number, y: number) {
    PANREPEAT.xpan = PANREPEAT.ypan = 0;
    PANREPEAT.xrepeat = x;
    PANREPEAT.yrepeat = y;
    this.selection.handle(PANREPEAT, ctx);
  }

  private insertSprite(ctx: BuildContext) {
    let [x, y] = snap(ctx);
    let hit = ctx.state.get<Hitscan>('hitscan');
    let z = hit.z;
    if (!isSector(hit.type)) return;
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      let spriteId = insertSprite(ctx.board, x, y, z);
      ctx.board.sprites[spriteId].picnum = picnum;
    });
  }

  private print(ctx: BuildContext) {
    let hit = ctx.state.get<Hitscan>('hitscan')
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
    let hit = ctx.state.get<Hitscan>('hitscan')
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


