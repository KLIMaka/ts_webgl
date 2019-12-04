import { detuple0, detuple1 } from "../../../../../libs/mathutils";
import { vec3 } from "../../../../../libs_js/glmatrix";
import { Deck } from "../../../../collections";
import { error, info } from "../../../../logger";
import { Bindable, BuildContext, Target } from "../../api";
import { insertSprite, loopWalls, nextwall, setFirstWall } from "../../boardutils";
import { BuildRenderableProvider } from "../../gl/renderable";
import { Message, MessageHandler, MessageHandlerList, MessageHandlerReflective } from "../../handlerapi";
import { Entity, EntityType } from "../../hitscan";
import { Board } from "../../structs";
import { build2gl, sectorOfWall } from "../../utils";
import { MovingHandle } from "../handle";
import { EndMove, Frame, Highlight, Move, NamedMessage, Render, SetPicnum, Shade, StartMove } from "../messages";
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

// function getAttachedSector(board: Board, hit: Hitscan): MessageHandler {
//   let wall = board.walls[hit.ent.id];
//   let sectorId = wall.nextsector == -1 ? sectorOfWall(board, hit.ent.id) : wall.nextsector;
//   let [x, y, z] = hit.target();
//   let type = getClosestSectorZ(board, sectorId, x, y, z)[0];
//   return SectorEnt.create(hit.ent.clone());
// }

let list = new Deck<MessageHandler>();
let segment = new Deck<number>();
export function getFromHitscan(ctx: BuildContext): Deck<MessageHandler> {
  const target = ctx.view.snapTarget();
  list.clear();
  if (target.entity == null) return list;
  const fullLoop = ctx.state.get<boolean>(LOOP_STATE);
  const board = ctx.board;
  if (target.entity.type == EntityType.WALL_POINT) {
    const w = target.entity.id;
    list.push(fullLoop ? WallSegmentsEnt.create(board, loopWalls(board, w, sectorOfWall(board, w))) : WallEnt.create(board, w));
  } else if (target.entity.isWall()) {
    wallSegment(fullLoop, board, target.entity.id, target.entity.type == EntityType.LOWER_WALL);
  } else if (target.entity.isSector()) {
    sector(fullLoop, board, target);
  } else if (target.entity.isSprite()) {
    list.push(SpriteEnt.create(target.entity.id));
  }
  return list;
}

function sector(fullLoop: boolean, board: Board, target: Target) {
  if (fullLoop) {
    let firstWall = board.sectors[target.entity.id].wallptr;
    list.push(WallSegmentsEnt.create(board, loopWalls(board, firstWall, target.entity.id)));
    list.push(SectorEnt.create(new Entity(target.entity.id, target.entity.type == EntityType.CEILING ? EntityType.FLOOR : EntityType.CEILING)));
  }
  list.push(SectorEnt.create(target.entity.clone()));
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

let target_ = vec3.create();
let start_ = vec3.create();
let dir_ = vec3.create();

export class Selection extends MessageHandlerReflective implements Bindable {
  private selection = new MessageHandlerList();
  private valid = true;

  constructor(
    private picnumSelector: PicNumSelector,
    private renderables: BuildRenderableProvider
  ) { super() }

  public bind(ctx: BuildContext) {
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
      case 'set_first_wall': this.setFirstWall(ctx); return;
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
    const vertical = ctx.state.get<boolean>(MOVE_VERTICAL);
    const parallel = ctx.state.get<boolean>(MOVE_PARALLEL);
    const { start, dir } = ctx.view.dir();
    handle.update(vertical, parallel, build2gl(start_, start), build2gl(dir_, dir));
  }

  private updateMove(ctx: BuildContext) {
    if (!handle.isActive() && ctx.state.get(MOVE_STATE)) {
      handle.start(build2gl(target_, ctx.view.target().coords));
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

  private setFirstWall(ctx: BuildContext) {
    const target = ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isWall()) return;
    setFirstWall(ctx.board, sectorOfWall(ctx.board, target.entity.id), target.entity.id);
    ctx.commit();
    ctx.invalidator.invalidateAll();
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
    const target = ctx.view.snapTarget();
    if (target.entity == null || !target.entity.isSector()) return;
    this.picnumSelector((picnum: number) => {
      if (picnum == -1) return;
      const [x, y, z] = target.coords;
      let spriteId = insertSprite(ctx.board, x, y, z);
      ctx.board.sprites[spriteId].picnum = picnum;
    });
  }

  private print(ctx: BuildContext) {
    const target = ctx.view.target();
    if (target.entity == null) return;
    switch (target.entity.type) {
      case EntityType.CEILING:
      case EntityType.FLOOR:
        info(target.entity.id, ctx.board.sectors[target.entity.id]);
        break;
      case EntityType.UPPER_WALL:
      case EntityType.MID_WALL:
      case EntityType.LOWER_WALL:
        info(target.entity.id, ctx.board.walls[target.entity.id]);
        break;
      case EntityType.SPRITE:
        info(target.entity.id, ctx.board.sprites[target.entity.id]);
        break;
    }
  }

  private copy(ctx: BuildContext) {
    const target = ctx.view.target();
    if (target.entity == null) return;
    switch (target.entity.type) {
      case EntityType.CEILING:
        clipboardShade.value = ctx.board.sectors[target.entity.id].ceilingshade;
        clipboardPicnum.picnum = ctx.board.sectors[target.entity.id].ceilingpicnum;
        break;
      case EntityType.FLOOR:
        clipboardShade.value = ctx.board.sectors[target.entity.id].floorshade;
        clipboardPicnum.picnum = ctx.board.sectors[target.entity.id].floorpicnum;
        break;
      case EntityType.LOWER_WALL:
      case EntityType.MID_WALL:
      case EntityType.UPPER_WALL:
        clipboardShade.value = ctx.board.walls[target.entity.id].shade;
        clipboardPicnum.picnum = ctx.board.walls[target.entity.id].picnum;
        break;
      case EntityType.SPRITE:
        clipboardShade.value = ctx.board.sprites[target.entity.id].shade;
        clipboardPicnum.picnum = ctx.board.sprites[target.entity.id].picnum;
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


