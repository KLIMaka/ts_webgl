import { List } from "../../../../libs/list";
import { len2d, cyclic, tuple } from "../../../../libs/mathutils";
import * as GLM from "../../../../libs_js/glmatrix";
import { Collection, Deck, IndexedDeck } from "../../../deck";
import { connectedWalls, moveWall, nextwall, prevwall, mergePoints } from "../boardutils";
import { Hitscan } from "../hitscan";
import { MessageHandlerReflective } from "../handlerapi";
import { Board } from "../structs";
import { sectorOfWall } from "../utils";
import { EndMove, Highlight, Move, SetPicnum, StartMove, Shade, PanRepeat, Palette, Flip } from "./messages";
import { invalidateSectorAndWalls } from "./editutils";
import { BuildContext } from "../api";

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
    if (chain.first().next != chain.terminator()) {
      let w1 = chain.first().obj;
      let w2 = chain.last().obj;
      if (board.walls[w2].point2 != w1)
        chain.pop();
    }
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

export class WallSegmentsEnt extends MessageHandlerReflective {
  private static invalidatedSectors = new IndexedDeck<number>();

  public static create(board: Board, ids: Collection<number>) {
    return new WallSegmentsEnt(board, ids);
  }

  constructor(
    board: Board,
    public wallIds: Collection<number>,
    public origin = GLM.vec2.create(),
    public refwall = -1,
    public active = false,
    public highlighted = collectHighlightedWalls(board, wallIds),
    public connectedWalls = collectConnectedWalls(board, wallIds),
    public motionSectors = collectMotionSectors(board, wallIds)) { super() }

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

  public StartMove(msg: StartMove, ctx: BuildContext) {
    this.refwall = getClosestWallByIds(ctx.board, msg.handle.hit, this.wallIds);
    let wall = ctx.board.walls[this.refwall];
    GLM.vec2.set(this.origin, wall.x, wall.y);
    this.active = true;
  }

  public Move(msg: Move, ctx: BuildContext) {
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

  public EndMove(msg: EndMove, ctx: BuildContext) {
    this.active = false;
    for (let i = 0; i < this.wallIds.length(); i++) mergePoints(ctx.board, this.wallIds.get(i));
  }

  public Highlight(msg: Highlight, ctx: BuildContext) {
    if (this.active) {
      let cwalls = this.connectedWalls;
      for (let i = 0; i < cwalls.length(); i++) {
        let w = cwalls.get(i);
        let s = sectorOfWall(ctx.board, w);
        let p = prevwall(ctx.board, w);
        msg.set.add(tuple(2, w));
        msg.set.add(tuple(3, w));
        msg.set.add(tuple(2, p));
        msg.set.add(tuple(0, s));
        msg.set.add(tuple(1, s));
      }
    } else {
      let hwalls = this.highlighted;
      for (let i = 0; i < hwalls.length(); i++) {
        let w = hwalls.get(i);
        msg.set.add(tuple(2, w));
      }
    }
  }

  public SetPicnum(msg: SetPicnum, ctx: BuildContext) {
    let hwalls = this.highlighted;
    for (let i = 0; i < hwalls.length(); i++) {
      let w = hwalls.get(i);
      let wall = ctx.board.walls[w];
      wall.picnum = msg.picnum;
      ctx.invalidator.invalidateWall(w);
    }
  }

  public Shade(msg: Shade, ctx: BuildContext) {
    let hwalls = this.highlighted;
    for (let i = 0; i < hwalls.length(); i++) {
      let w = hwalls.get(i);
      let wall = ctx.board.walls[w];
      let shade = wall.shade;
      if (msg.absolute && shade == msg.value) return;
      if (msg.absolute) wall.shade = msg.value; else wall.shade += msg.value;
      ctx.invalidator.invalidateWall(w);
    }
  }

  public PanRepeat(msg: PanRepeat, ctx: BuildContext) {
    let hwalls = this.highlighted;
    for (let i = 0; i < hwalls.length(); i++) {
      let w = hwalls.get(i);
      let wall = ctx.board.walls[w];
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
      ctx.invalidator.invalidateWall(w);
    }
  }

  public Palette(msg: Palette, ctx: BuildContext) {
    let hwalls = this.highlighted;
    for (let i = 0; i < hwalls.length(); i++) {
      let w = hwalls.get(i);
      let wall = ctx.board.walls[w];
      if (msg.absolute) {
        if (msg.value == wall.pal) return;
        wall.pal = msg.value;
      } else {
        wall.pal = cyclic(wall.pal + msg.value, msg.max);
      }
      ctx.invalidator.invalidateWall(w);
    }
  }

  public Flip(msg: Flip, ctx: BuildContext) {
    let hwalls = this.highlighted;
    for (let i = 0; i < hwalls.length(); i++) {
      let w = hwalls.get(i);
      let wall = ctx.board.walls[w];
      let flip = wall.cstat.xflip + wall.cstat.yflip * 2;
      let nflip = cyclic(flip + 1, 4);
      wall.cstat.xflip = nflip & 1;
      wall.cstat.yflip = (nflip & 2) >> 1;
      ctx.invalidator.invalidateWall(w);
    }
  }
}
