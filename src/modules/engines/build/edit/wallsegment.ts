import { List } from "../../../../libs/list";
import { len2d } from "../../../../libs/mathutils";
import * as GLM from "../../../../libs_js/glmatrix";
import { Collection, Deck, IndexedDeck } from "../../../deck";
import { connectedWalls, moveWall, nextwall, prevwall } from "../boardutils";
import { Hitscan } from "../hitscan";
import { MessageHandlerFactory } from "../messages";
import { Board } from "../structs";
import { sectorOfWall } from "../utils";
import { StartMove, Move, EndMove, Highlight, BuildContext, SetPicnum } from "./editapi";
import { invalidateSectorAndWalls } from "./editutils";

function getClosestWallByIds(board: Board, hit: Hitscan, ids: Collection<number>): number {
  if (ids.length() == 1) return ids.get(0);
  let id = -1;
  let mindist = Number.MAX_VALUE;
  for (let i = 0; i < ids.length(); i++) {
    let w = ids.get(i);
    let wall = board.walls[w];
    let dist = len2d(wall.x - hit.x, wall.y - hit.y);
    if (dist < mindist) {
      id = w;
      mindist = dist;
    }
  }
  return id;
}

function collectHighlightedWalls(board: Board, walls: Collection<number>): Collection<number> {
  let result = new Deck<number>();
  let chains = new Deck<List<number>>();
  for (let i = 0; i < walls.length(); i++) {
    let w = walls.get(i);
    let partOfOldChain = false;
    for (let c = 0; c < chains.length(); c++) {
      let chain = chains.get(c);
      if (nextwall(board, w) == chain.first().obj) {
        chain.insertBefore(w);
        partOfOldChain = true;
        break;
      } else if (prevwall(board, w) == chain.last().obj) {
        chain.insertAfter(w);
        partOfOldChain = true;
        break;
      }
    }
    if (!partOfOldChain) {
      let l = new List<number>();
      l.push(w);
      chains.push(l);
    }
  }
  for (let c = 0; c < chains.length(); c++) {
    let chain = chains.get(c);
    if (chain.first().next != chain.terminator())
      chain.pop();
    for (let node = chain.first(); node != chain.terminator(); node = node.next) {
      result.push(node.obj);
    }
  }
  return result;
}

function collectConnectedWalls(board: Board, walls: Collection<number>) {
  let result = new Deck<number>();
  for (let i = 0; i < walls.length(); i++) {
    let w = walls.get(i);
    connectedWalls(board, w, result);
  }
  return result;
}

function collectMotionSectors(board: Board, walls: Collection<number>): Set<number> {
  let sectors = new Set<number>();
  return sectors;
}

export class WallSegmentsEnt {
  private static invalidatedSectors = new IndexedDeck<number>();
  private static factory = new MessageHandlerFactory()
    .register(StartMove, (obj: WallSegmentsEnt, msg: StartMove, ctx: BuildContext) => obj.startMove(msg, ctx))
    .register(Move, (obj: WallSegmentsEnt, msg: Move, ctx: BuildContext) => obj.move(msg, ctx))
    .register(EndMove, (obj: WallSegmentsEnt, msg: EndMove, ctx: BuildContext) => obj.endMove(msg, ctx))
    .register(SetPicnum, (obj: WallSegmentsEnt, msg: SetPicnum, ctx: BuildContext) => obj.setpicnum(msg, ctx))
    .register(Highlight, (obj: WallSegmentsEnt, msg: Highlight, ctx: BuildContext) => obj.highlight(msg, ctx));

  public static create(board: Board, ids: Collection<number>) {
    return WallSegmentsEnt.factory.handler(new WallSegmentsEnt(board, ids));
  }

  constructor(
    board: Board,
    public wallIds: Collection<number>,
    public origin = GLM.vec2.create(),
    public refwall = -1,
    public active = false,
    public highlighted = collectHighlightedWalls(board, wallIds),
    public connectedWalls = collectConnectedWalls(board, wallIds),
    public motionSectors = collectMotionSectors(board, wallIds)) { }

  private invalidate(ctx: BuildContext) {
    let invalidatedSectors = WallSegmentsEnt.invalidatedSectors.clear();
    let cwalls = this.connectedWalls;
    for (let i = 0; i < cwalls.length(); i++) {
      let w = cwalls.get(i);
      let s = sectorOfWall(ctx.board, w);
      if (invalidatedSectors.indexOf(s) == -1) {
        invalidateSectorAndWalls(s, ctx);
        invalidatedSectors.push(s);
      }
    }
  }

  public startMove(msg: StartMove, ctx: BuildContext) {
    this.refwall = getClosestWallByIds(ctx.board, msg.handle.hit, this.wallIds);
    let wall = ctx.board.walls[this.refwall];
    GLM.vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  public move(msg: Move, ctx: BuildContext) {
    let x = ctx.snap(this.origin[0] + msg.handle.dx());
    let y = ctx.snap(this.origin[1] + msg.handle.dy());
    let refwall = ctx.board.walls[this.refwall];
    let dx = x - refwall.x;
    let dy = y - refwall.y;
    if (moveWall(ctx.board, this.refwall, x, y)) {
      for (let i = 0; i < this.wallIds.length(); i++) {
        let w = this.wallIds.get(i);
        if (w == this.refwall) continue;
        let wall = ctx.board.walls[w];
        moveWall(ctx.board, w, wall.x + dx, wall.y + dy);
      }
      this.invalidate(ctx);
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
      let hwalls = this.highlighted;
      for (let i = 0; i < hwalls.length(); i++) {
        let w = hwalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        ctx.highlightWallSegment(ctx.gl, ctx.board, w, s);
      }
    }
  }

  public setpicnum(msg: SetPicnum, ctx: BuildContext) {
    let hwalls = this.highlighted;
    for (let i = 0; i < hwalls.length(); i++) {
      let w = hwalls.get(i);
      let wall = ctx.board.walls[w];
      wall.picnum = msg.picnum;
      ctx.invalidateWall(w);
    }
  }
}
