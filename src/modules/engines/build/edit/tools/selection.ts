import { BuildContext } from "../../api";
import { insertSprite, loopWalls, nextwall, closestWallLineInSector } from "../../boardutils";
import { Hitscan, isSector, SubType, isWall, isSprite } from "../../hitscan";
import { MessageHandlerReflective, MessageHandlerList, MessageHandler } from "../../handlerapi";
import { EndMove, Flip, HitScan, Input, Move, Palette, PanRepeat, SetPicnum, Shade, SpriteMode, StartMove, ToggleParallax, Render, Highlight, SetWallCstat } from "../messages";
import { snap, getClosestWall, getClosestSectorZ } from "../editutils";
import { MovingHandle } from "../handle";
import { BuildRenderableProvider } from "../../gl/renderable";
import { detuple0, detuple1 } from "../../../../../libs/mathutils";
import { Deck } from "../../../../deck";
import { WallSegmentsEnt } from "../wallsegment";
import { sectorOfWall } from "../../utils";
import { WallEnt } from "../wall";
import { SectorEnt } from "../sector";
import { SpriteEnt } from "../sprite";
import { Board } from "../../structs";
import { action } from "../../../../keymap";
import { info } from "../../../../logger";

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
export function getFromHitscan(ctx: BuildContext, hit: Hitscan, fullLoop = false): Deck<MessageHandler> {
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
  private hit: Hitscan;
  private fulloop = false;

  constructor(
    private picnumSelector: PicNumSelector,
    private renderables: BuildRenderableProvider
  ) {
    super();
  }

  public HitScan(msg: HitScan, ctx: BuildContext) {
    this.hit = msg.hit;
    if (handle.isActive()) return;
    this.selection.list().clear().pushAll(getFromHitscan(ctx, msg.hit, this.fulloop));
  }

  public Input(msg: Input, ctx: BuildContext) {
    this.fulloop = action('select_loop_mod', msg.state)
    if (action('print_selected', msg.state)) this.print(ctx, this.hit.id, this.hit.type);
    if (this.selection.list().isEmpty()) return;

    if (this.activeMove(msg)) {
      this.updateHandle(msg);
      this.updateMove(msg, ctx);
    } else {
      this.handleSelected(msg, ctx);
    }
  }

  private activeMove(msg: Input) {
    let start = !handle.isActive() && action('move', msg.state);
    let move = handle.isActive() && action('move', msg.state);
    let end = handle.isActive() && !action('move', msg.state);
    return start || move || end;
  }

  private updateHandle(msg: Input) {
    let mod1 = action('mod1', msg.state);
    let mod2 = action('mod2', msg.state);
    let mod3 = action('mod3', msg.state);
    handle.update(mod1, mod2, mod3, this.hit);
  }

  private updateMove(msg: Input, ctx: BuildContext) {
    if (!handle.isActive() && action('move', msg.state)) {
      handle.start(this.hit);
      this.selection.handle(START_MOVE, ctx);
    } else if (!action('move', msg.state)) {
      handle.stop();
      this.selection.handle(END_MOVE, ctx);
      return;
    }

    this.selection.handle(MOVE, ctx);
  }

  private handleSelected(msg: Input, ctx: BuildContext) {
    if (action('set_picnum', msg.state)) this.setTexture(ctx);
    else if (action('toggle_parallax', msg.state)) this.selection.handle(TOGGLE_PARALLAX, ctx);
    else if (action('repeat_y_scaled+', msg.state)) this.sendRepeat(msg, ctx, 0, PAN_SCALE);
    else if (action('repeat_y_scaled-', msg.state)) this.sendRepeat(msg, ctx, 0, -PAN_SCALE);
    else if (action('repeat_x_scaled-', msg.state)) this.sendRepeat(msg, ctx, -PAN_SCALE, 0);
    else if (action('repeat_x_scaled+', msg.state)) this.sendRepeat(msg, ctx, PAN_SCALE, 0);
    else if (action('repeat_y+', msg.state)) this.sendRepeat(msg, ctx, 0, 1);
    else if (action('repeat_y-', msg.state)) this.sendRepeat(msg, ctx, 0, -1);
    else if (action('repeat_x-', msg.state)) this.sendRepeat(msg, ctx, -1, 0);
    else if (action('repeat_x+', msg.state)) this.sendRepeat(msg, ctx, 1, 0);
    else if (action('pan_y_scaled+', msg.state)) this.sendPan(msg, ctx, 0, PAN_SCALE);
    else if (action('pan_y_scaled-', msg.state)) this.sendPan(msg, ctx, 0, -PAN_SCALE);
    else if (action('pan_x_scaled-', msg.state)) this.sendPan(msg, ctx, -PAN_SCALE, 0);
    else if (action('pan_x_scaled+', msg.state)) this.sendPan(msg, ctx, PAN_SCALE, 0);
    else if (action('pan_y+', msg.state)) this.sendPan(msg, ctx, 0, 1);
    else if (action('pan_y-', msg.state)) this.sendPan(msg, ctx, 0, -1);
    else if (action('pan_x-', msg.state)) this.sendPan(msg, ctx, -1, 0);
    else if (action('pan_x+', msg.state)) this.sendPan(msg, ctx, 1, 0);
    else if (action('cycle_pal', msg.state)) this.selection.handle(PALETTE, ctx);
    else if (action('flip', msg.state)) this.selection.handle(FLIP, ctx);
    else if (action('insert_sprite', msg.state)) this.insertSprite(ctx);
    else if (action('swap_bottoms', msg.state)) this.selection.handle(SWAP_BOTTOMS, ctx);
    else if (action('align_bottom', msg.state)) this.selection.handle(ALIGN_BOTTOM, ctx);
    else if (action('sprite_mode', msg.state)) this.selection.handle(SPRITE_MODE, ctx);
    else if (action('copy', msg.state)) this.copy(msg, ctx);
    else if (action('paste_shade', msg.state)) this.selection.handle(clipboardShade, ctx);
    else if (action('paste_picnum', msg.state)) this.selection.handle(clipboardPicnum, ctx);
    else if (action('shade+', msg.state)) this.sendShadeChange(msg, 1, ctx);
    else if (action('shade-', msg.state)) this.sendShadeChange(msg, -1, ctx);
    else if (action('shade_scaled+', msg.state)) this.sendShadeChange(msg, SHADOW_SCALE, ctx);
    else if (action('shade_scaled-', msg.state)) this.sendShadeChange(msg, -SHADOW_SCALE, ctx);
  }

  private setTexture(ctx: BuildContext) {
    let sel = this.selection.clone();
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      SET_PICNUM.picnum = picnum;
      sel.handle(SET_PICNUM, ctx);
    })
  }

  private sendShadeChange(msg: Input, change: number, ctx: BuildContext) {
    SHADE_CHANGE.value = change;
    this.selection.handle(SHADE_CHANGE, ctx);
  }

  private sendPan(msg: Input, ctx: BuildContext, x: number, y: number) {
    PANREPEAT.xrepeat = PANREPEAT.yrepeat = 0;
    PANREPEAT.xpan = x;
    PANREPEAT.ypan = y;
    this.selection.handle(PANREPEAT, ctx);
  }

  private sendRepeat(msg: Input, ctx: BuildContext, x: number, y: number) {
    PANREPEAT.xpan = PANREPEAT.ypan = 0;
    PANREPEAT.xrepeat = x;
    PANREPEAT.yrepeat = y;
    this.selection.handle(PANREPEAT, ctx);
  }

  private insertSprite(ctx: BuildContext) {
    let [x, y] = snap(this.hit, ctx);
    let z = this.hit.z;
    if (!isSector(this.hit.type)) return;
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      let spriteId = insertSprite(ctx.board, x, y, z);
      ctx.board.sprites[spriteId].picnum = picnum;
    });
  }

  private print(ctx: BuildContext, id: number, type: SubType) {
    switch (type) {
      case SubType.CEILING:
      case SubType.FLOOR:
        info(id); info(ctx.board.sectors[id]);
        break;
      case SubType.UPPER_WALL:
      case SubType.MID_WALL:
      case SubType.LOWER_WALL:
        info(id); info(ctx.board.walls[id]);
        break;
      case SubType.SPRITE:
        info(id); info(ctx.board.sprites[id]);
        break;
    }
  }

  private copy(msg: Input, ctx: BuildContext) {
    if (this.hit.t == -1) return;
    switch (this.hit.type) {
      case SubType.CEILING:
        clipboardShade.value = ctx.board.sectors[this.hit.id].ceilingshade;
        clipboardPicnum.picnum = ctx.board.sectors[this.hit.id].ceilingpicnum;
        break;
      case SubType.FLOOR:
        clipboardShade.value = ctx.board.sectors[this.hit.id].floorshade;
        clipboardPicnum.picnum = ctx.board.sectors[this.hit.id].floorpicnum;
        break;
      case SubType.LOWER_WALL:
      case SubType.MID_WALL:
      case SubType.UPPER_WALL:
        clipboardShade.value = ctx.board.walls[this.hit.id].shade;
        clipboardPicnum.picnum = ctx.board.walls[this.hit.id].picnum;
        break;
      case SubType.SPRITE:
        clipboardShade.value = ctx.board.sprites[this.hit.id].shade;
        clipboardPicnum.picnum = ctx.board.sprites[this.hit.id].picnum;
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


