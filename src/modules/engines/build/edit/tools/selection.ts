import { BuildContext } from "../../api";
import { insertSprite } from "../../boardutils";
import { Hitscan, isSector, SubType } from "../../hitscan";
import { MessageHandlerIml, MessageHandlerList } from "../../messages";
import { getFromHitscan } from "../edit";
import { EndMove, Flip, HitScan, Input, Move, Palette, PanRepeat, SetPicnum, Shade, SpriteMode, StartMove, ToggleParallax, Render, Highlight } from "../editapi";
import { snap } from "../editutils";
import { MovingHandle } from "../handle";
import { BuildRenderableProvider } from "../../gl/renderable";
import { detuple0, detuple1 } from "../../../../../libs/mathutils";

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

export class Selection extends MessageHandlerIml {
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
    this.selection.clear();
    let list = getFromHitscan(ctx, msg.hit, this.fulloop);
    for (let i = 0; i < list.length(); i++) {
      this.selection.add(list.get(i));
    }
  }

  public Input(msg: Input, ctx: BuildContext) {
    this.fulloop = msg.state.keys['TAB'];

    if (msg.state.mouseClicks[0]) this.print(ctx, this.hit.id, this.hit.type);

    if (this.selection.isEmpty()) return;

    if (this.activeMove(msg)) {
      this.updateHandle(msg, ctx);
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

  private updateHandle(msg: Input, ctx: BuildContext) {
    let mod1 = msg.state.keys['SHIFT'];
    let mod2 = msg.state.keys['ALT'];
    let mod3 = msg.state.keys['CTRL'];
    handle.update(mod1, mod2, mod3, this.hit, ctx.board);
  }

  private updateMove(msg: Input, ctx: BuildContext) {
    if (!handle.isActive() && msg.state.mouseButtons[0]) {
      console.log('start move');
      handle.start(this.hit);
      this.selection.handle(START_MOVE, ctx);
    } else if (!msg.state.mouseButtons[0]) {
      handle.stop();
      console.log('end move');
      this.selection.handle(END_MOVE, ctx);
      return;
    }

    console.log('move');
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
