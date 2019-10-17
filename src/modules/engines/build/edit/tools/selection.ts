import { BuildContext } from "../../api";
import { insertSprite, loopWalls, nextwall, closestWallLineInSector } from "../../boardutils";
import { Hitscan, isSector, SubType, isWall, isSprite } from "../../hitscan";
import { MessageHandlerReflective, MessageHandlerList, MessageHandler } from "../../handlerapi";
import { EndMove, Flip, HitScan, Input, Move, Palette, PanRepeat, SetPicnum, Shade, SpriteMode, StartMove, ToggleParallax, Render, Highlight } from "../messages";
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
  let w = getClosestWall(board, hit, ctx);
  if (w != -1) {
    list.push(fullLoop ? WallSegmentsEnt.create(board, loopWalls(board, w, sectorOfWall(board, w))) : WallEnt.create(board, w));
  } else if (isWall(hit.type)) {
    wallSegment(fullLoop, board, hit.id);
  } else if (isSector(hit.type)) {
    let w = closestWallLineInSector(board, hit.id, hit.x, hit.y, ctx.snapScale());
    if (w != -1) wallSegment(fullLoop, board, w); else sector(fullLoop, board, hit);
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

function wallSegment(fullLoop: boolean, board: Board, w: number) {
  if (fullLoop) {
    list.push(WallSegmentsEnt.create(board, loopWalls(board, w, sectorOfWall(board, w))));
  } else {
    let w1 = nextwall(board, w);
    segment.clear().push(w).push(w1);
    list.push(WallSegmentsEnt.create(board, segment));
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
    this.selection.clear().pushAll(getFromHitscan(ctx, msg.hit, this.fulloop));
  }

  public Input(msg: Input, ctx: BuildContext) {
    this.fulloop = msg.state.keys['TAB'];

    if (msg.state.mouseClicks[0]) this.print(ctx, this.hit.id, this.hit.type);

    if (this.selection.isEmpty()) return;

    if (this.activeMove(msg)) {
      this.updateHandle(msg);
      this.updateMove(msg, ctx);
    } else {
      this.handleSelected(msg, ctx);
    }
  }

  private activeMove(msg: Input) {
    let start = !handle.isActive() && msg.state.mouseButtons[0];
    let move = handle.isActive() && msg.state.mouseButtons[0];
    let end = handle.isActive() && !msg.state.mouseButtons[0];
    return start || move || end;
  }

  private updateHandle(msg: Input) {
    let mod1 = msg.state.keys['SHIFT'];
    let mod2 = msg.state.keys['ALT'];
    let mod3 = msg.state.keys['CTRL'];
    handle.update(mod1, mod2, mod3, this.hit);
  }

  private updateMove(msg: Input, ctx: BuildContext) {
    if (!handle.isActive() && msg.state.mouseButtons[0]) {
      handle.start(this.hit);
      this.selection.handle(START_MOVE, ctx);
    } else if (!msg.state.mouseButtons[0]) {
      handle.stop();
      this.selection.handle(END_MOVE, ctx);
      return;
    }

    this.selection.handle(MOVE, ctx);
  }

  private handleSelected(msg: Input, ctx: BuildContext) {
    if (msg.state.keysPress['V']) this.setTexture(ctx);
    if (msg.state.keysPress['P']) this.selection.handle(TOGGLE_PARALLAX, ctx);
    if (msg.state.keysPress['UP']) this.sendPanRepeat(msg, ctx, 0, 1);
    if (msg.state.keysPress['DOWN']) this.sendPanRepeat(msg, ctx, 0, -1);
    if (msg.state.keysPress['LEFT']) this.sendPanRepeat(msg, ctx, -1, 0);
    if (msg.state.keysPress['RIGHT']) this.sendPanRepeat(msg, ctx, 1, 0);
    if (msg.state.keysPress['O']) this.selection.handle(PALETTE, ctx);
    if (msg.state.keysPress['F']) this.selection.handle(FLIP, ctx);
    if (msg.state.keysPress['L']) this.insertSprite(ctx);
    if (msg.state.keysPress['R']) this.selection.handle(SPRITE_MODE, ctx);
    if (msg.state.keysPress['1']) this.copy(msg, ctx);
    if (msg.state.keysPress['2']) this.selection.handle(clipboardShade, ctx);
    if (msg.state.keysPress['3']) this.selection.handle(clipboardPicnum, ctx);
    if (msg.state.wheel != 0) this.sendShadeChange(msg, ctx);
  }

  private setTexture(ctx: BuildContext) {
    let sel = this.selection.clone();
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      SET_PICNUM.picnum = picnum;
      sel.handle(SET_PICNUM, ctx);
    })
  }

  private sendShadeChange(msg: Input, ctx: BuildContext) {
    SHADE_CHANGE.value = msg.state.wheel * (msg.state.keys['SHIFT'] ? 8 : 1);
    this.selection.handle(SHADE_CHANGE, ctx);
  }

  private sendPanRepeat(msg: Input, ctx: BuildContext, x: number, y: number) {
    if (msg.state.keys['CTRL']) {
      PANREPEAT.xpan = PANREPEAT.ypan = 0;
      PANREPEAT.xrepeat = x * (msg.state.keys['SHIFT'] ? 1 : 8);
      PANREPEAT.yrepeat = y * (msg.state.keys['SHIFT'] ? 1 : 8);
    } else {
      PANREPEAT.xrepeat = PANREPEAT.yrepeat = 0;
      PANREPEAT.xpan = x * (msg.state.keys['SHIFT'] ? 1 : 8);
      PANREPEAT.ypan = y * (msg.state.keys['SHIFT'] ? 1 : 8);
    }
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
        console.log(id, ctx.board.sectors[id]);
        break;
      case SubType.UPPER_WALL:
      case SubType.MID_WALL:
      case SubType.LOWER_WALL:
        console.log(id, ctx.board.walls[id]);
        break;
      case SubType.SPRITE:
        console.log(id, ctx.board.sprites[id]);
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


