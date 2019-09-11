import * as GLM from "../../../../libs_js/glmatrix";
import { Deck, IndexedDeck } from "../../../deck";
import { connectedWalls, moveWall, prevwall } from "../boardutils";
import { MessageHandlerFactory } from "../messages";
import { Board } from "../structs";
import { sectorOfWall } from "../utils";
import { invalidateSectorAndWalls } from "./editutils";
import { BuildContext, EndMove, Highlight, Move, StartMove } from "./editapi";

function collectConnectedWalls(board: Board, wallId: number) {
  let result = new Deck<number>();
  connectedWalls(board, wallId, result);
  return result;
}

export class WallEnt {
  private static invalidatedSectors = new IndexedDeck<number>();
  private static factory = new MessageHandlerFactory()
    .register(StartMove, (obj: WallEnt, msg: StartMove, ctx: BuildContext) => obj.startMove(msg, ctx))
    .register(Move, (obj: WallEnt, msg: Move, ctx: BuildContext) => obj.move(msg, ctx))
    .register(EndMove, (obj: WallEnt, msg: EndMove, ctx: BuildContext) => obj.endMove(msg, ctx))
    .register(Highlight, (obj: WallEnt, msg: Highlight, ctx: BuildContext) => obj.highlight(msg, ctx));

  public static create(board: Board, id: number) {
    return WallEnt.factory.handler(new WallEnt(board, id));
  }

  constructor(
    board: Board,
    public wallId: number,
    public origin = GLM.vec2.create(),
    public active = false,
    public connectedWalls = collectConnectedWalls(board, wallId)) { }

  public startMove(msg: StartMove, ctx: BuildContext) {
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

  public move(msg: Move, ctx: BuildContext) {
    if (!msg.handle.elevate) {
      let x = ctx.snap(this.origin[0] + msg.handle.dx());
      let y = ctx.snap(this.origin[1] + msg.handle.dy());
      if (moveWall(ctx.board, this.wallId, x, y)) {
        this.invalidate(ctx);
      }
    }
  }

  public endMove(msg: EndMove, ctx: BuildContext) {
    this.active = false;
  }

  public highlight(msg: Highlight, ctx: BuildContext) {
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
}
