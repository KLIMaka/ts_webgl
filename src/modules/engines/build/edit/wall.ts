import { cyclic } from "../../../../libs/mathutils";
import * as GLM from "../../../../libs_js/glmatrix";
import { Deck, IndexedDeck } from "../../../deck";
import { connectedWalls, moveWall, prevwall } from "../boardutils";
import { MessageHandlerIml } from "../messages";
import { Board } from "../structs";
import { sectorOfWall } from "../utils";
import { BuildContext, EndMove, Flip, Highlight, Move, Palette, PanRepeat, SetPicnum, Shade, StartMove } from "./editapi";
import { invalidateSectorAndWalls } from "./editutils";

function collectConnectedWalls(board: Board, wallId: number) {
  let result = new Deck<number>();
  connectedWalls(board, wallId, result);
  return result;
}

export class WallEnt extends MessageHandlerIml {
  private static invalidatedSectors = new IndexedDeck<number>();

  public static create(board: Board, id: number) {
    return new WallEnt(board, id);
  }

  constructor(
    board: Board,
    public wallId: number,
    public origin = GLM.vec2.create(),
    public active = false,
    public connectedWalls = collectConnectedWalls(board, wallId)) { super() }

  public StartMove(msg: StartMove, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    GLM.vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  private invalidate(ctx: BuildContext) {
    WallEnt.invalidatedSectors.clear();
    let cwalls = this.connectedWalls;
    for (let i = 0; i < cwalls.length(); i++) {
      let w = cwalls.get(i);
      let s = sectorOfWall(ctx.board, w);
      if (WallEnt.invalidatedSectors.indexOf(s) == -1) {
        invalidateSectorAndWalls(s, ctx);
        WallEnt.invalidatedSectors.push(s);
      }
    }
  }

  public Move(msg: Move, ctx: BuildContext) {
    let x = ctx.snap(this.origin[0] + msg.handle.dx());
    let y = ctx.snap(this.origin[1] + msg.handle.dy());
    if (moveWall(ctx.board, this.wallId, x, y)) {
      this.invalidate(ctx);
    }
  }

  public EndMove(msg: EndMove, ctx: BuildContext) {
    this.active = false;
  }

  public Highlight(msg: Highlight, ctx: BuildContext) {
    if (this.active) {
      let cwalls = this.connectedWalls;
      for (let i = 0; i < cwalls.length(); i++) {
        let w = cwalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        ctx.highlightWall(ctx.gl, ctx.board, w);
        ctx.highlightWallSegment(ctx.gl, ctx.board, w, s);
        let p = prevwall(ctx.board, w);
        ctx.highlightWallSegment(ctx.gl, ctx.board, p, s);
        ctx.highlightSector(ctx.gl, ctx.board, s);
      }
    } else {
      ctx.highlightWall(ctx.gl, ctx.board, this.wallId);
    }
  }

  public SetPicnum(msg: SetPicnum, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    wall.picnum = msg.picnum;
    ctx.invalidateWall(this.wallId);
  }

  public Shade(msg: Shade, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    let shade = wall.shade;
    if (msg.absolute && shade == msg.value) return;
    if (msg.absolute) wall.shade = msg.value; else wall.shade += msg.value;
    ctx.invalidateWall(this.wallId);
  }

  public PanRepeat(msg: PanRepeat, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    if (msg.absolute) {
      if (wall.xpanning == msg.xpan && wall.ypanning == msg.ypan && wall.xrepeat == msg.xrepeat && wall.yrepeat == msg.yrepeat) return;
      wall.xpanning = msg.xpan;
      wall.ypanning = msg.ypan;
      wall.xrepeat = msg.xrepeat;
      wall.yrepeat = msg.yrepeat;
    } else {
      wall.xpanning += msg.xpan;
      wall.ypanning += msg.ypan;
      wall.xrepeat += msg.xrepeat;
      wall.yrepeat += msg.yrepeat;
    }
    ctx.invalidateWall(this.wallId);
  }

  public Palette(msg: Palette, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    if (msg.absolute) {
      if (msg.value == wall.pal) return;
      wall.pal = msg.value;
    } else {
      wall.pal = cyclic(wall.pal + msg.value, msg.max);
    }
    ctx.invalidateWall(this.wallId);
  }

  public Flip(msg: Flip, ctx: BuildContext) {
    let wall = ctx.board.walls[this.wallId];
    let flip = wall.cstat.xflip + wall.cstat.yflip * 2;
    let nflip = cyclic(flip + 1, 4);
    wall.cstat.xflip = nflip & 1;
    wall.cstat.yflip = (nflip & 2) >> 1;
    ctx.invalidateWall(this.wallId);
  }
}
