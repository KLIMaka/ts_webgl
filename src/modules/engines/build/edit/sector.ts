import { cyclic, tuple } from "../../../../libs/mathutils";
import * as GLM from "../../../../libs_js/glmatrix";
import { BuildContext } from "../api";
import { MessageHandlerReflective } from "../handlerapi";
import { Hitscan, isSector, SubType } from "../hitscan";
import { heinumCalc, sectorZ, setSectorHeinum, setSectorPicnum, setSectorZ, ZSCALE } from "../utils";
import { invalidateSectorAndWalls } from "./editutils";
import { Highlight, Move, Palette, PanRepeat, ResetPanRepeat, SetPicnum, SetSectorCstat, Shade, StartMove } from "./messages";
import { MOVE_ROTATE, MOVE_VERTICAL } from "./tools/selection";

const resetPanrepeat = new PanRepeat(0, 0, 0, 0, true);

export class SectorEnt extends MessageHandlerReflective {

  public static create(id: number, type: SubType) {
    return new SectorEnt(id, type);
  }

  constructor(
    public sectorId: number,
    public type: SubType,
    public originz = 0,
    public origin = GLM.vec2.create()
  ) { super() }

  public StartMove(msg: StartMove, ctx: BuildContext) {
    let x = ctx.hitscan.x;
    let y = ctx.hitscan.y;
    // let sec = ctx.board.sectors[this.sectorId];
    // let slope = createSlopeCalculator(sec, ctx.board.walls);
    // this.originz = slope(x, y, this.type == HitType.CEILING ? sec.ceilingheinum : sec.floorheinum) + sectorZ(ctx.board, this.sectorId, this.type)) / ZSCALE;
    this.originz = sectorZ(ctx.board, this.sectorId, this.type) / ZSCALE;
    GLM.vec2.set(this.origin, x, y);
  }

  public Move(msg: Move, ctx: BuildContext) {
    if (ctx.state.get(MOVE_ROTATE)) {
      let x = this.origin[0];
      let y = this.origin[1];
      let z = ctx.snap(this.originz + msg.dz * ZSCALE);
      let h = heinumCalc(ctx.board, this.sectorId, x, y, z);
      if (setSectorHeinum(ctx.board, this.sectorId, this.type, h))
        invalidateSectorAndWalls(this.sectorId, ctx);
    } else if (ctx.state.get(MOVE_VERTICAL)) {
      let hit = ctx.hitscan;
      let z = isSector(hit.type) && hit.id != this.sectorId
        ? sectorZ(ctx.board, hit.id, hit.type) / ZSCALE
        : ctx.snap(this.originz + msg.dz);
      if (setSectorZ(ctx.board, this.sectorId, this.type, z * ZSCALE))
        invalidateSectorAndWalls(this.sectorId, ctx);
    }
  }

  public Highlight(msg: Highlight, ctx: BuildContext) {
    msg.set.add(tuple(this.type == SubType.CEILING ? 0 : 1, this.sectorId));
  }

  public SetPicnum(msg: SetPicnum, ctx: BuildContext) {
    if (setSectorPicnum(ctx.board, this.sectorId, this.type, msg.picnum))
      ctx.invalidator.invalidateSector(this.sectorId);
  }

  public Shade(msg: Shade, ctx: BuildContext) {
    let sector = ctx.board.sectors[this.sectorId];
    let shade = this.type == SubType.CEILING ? sector.ceilingshade : sector.floorshade;
    if (msg.absolute && msg.value == shade) return;
    if (msg.absolute) {
      if (this.type == SubType.CEILING) sector.ceilingshade = msg.value; else sector.floorshade = msg.value;
    } else {
      if (this.type == SubType.CEILING) sector.ceilingshade += msg.value; else sector.floorshade += msg.value;
    }
    ctx.invalidator.invalidateSector(this.sectorId);
  }

  public ResetPanRepeat(msg: ResetPanRepeat, ctx: BuildContext) {
    this.PanRepeat(resetPanrepeat, ctx);
  }

  public PanRepeat(msg: PanRepeat, ctx: BuildContext) {
    let sector = ctx.board.sectors[this.sectorId];
    if (msg.absolute) {
      if (this.type == SubType.CEILING) {
        if (sector.ceilingxpanning == msg.xpan && sector.ceilingypanning == msg.ypan) return;
        sector.ceilingxpanning = msg.xpan;
        sector.ceilingypanning = msg.ypan;
      } else {
        if (sector.floorxpanning == msg.xpan && sector.floorypanning == msg.ypan) return;
        sector.floorxpanning = msg.xpan;
        sector.floorypanning = msg.ypan;
      }
    } else {
      if (this.type == SubType.CEILING) {
        sector.ceilingxpanning += msg.xpan;
        sector.ceilingypanning += msg.ypan;
      } else {
        sector.floorxpanning += msg.xpan;
        sector.floorypanning += msg.ypan;
      }
    }
    ctx.invalidator.invalidateSector(this.sectorId);
  }

  public Palette(msg: Palette, ctx: BuildContext) {
    let sector = ctx.board.sectors[this.sectorId];
    if (msg.absolute) {
      if (this.type == SubType.CEILING) {
        if (msg.value == sector.ceilingpal) return;
        sector.ceilingpal = msg.value;
      } else {
        if (msg.value == sector.floorpal) return;
        sector.floorpal = msg.value;
      }
    } else {
      if (this.type == SubType.CEILING) {
        sector.ceilingpal = cyclic(sector.ceilingpal + msg.value, msg.max);
      } else {
        sector.floorpal = cyclic(sector.floorpal + msg.value, msg.max);
      }
    }
    ctx.invalidator.invalidateSector(this.sectorId);
  }

  public SetSectorCstat(msg: SetSectorCstat, ctx: BuildContext) {
    let sector = ctx.board.sectors[this.sectorId];
    let stat = this.type == SubType.CEILING ? sector.ceilingstat[msg.name] : sector.floorstat[msg.name];
    if (msg.toggle) {
      let nstat = stat ? 0 : 1;
      if (this.type == SubType.CEILING) sector.ceilingstat[msg.name] = nstat; else sector.floorstat[msg.name] = nstat;
    } else {
      if (stat == msg.value) return;
      if (this.type == SubType.CEILING) sector.ceilingstat[msg.name] = msg.value; else sector.floorstat[msg.name] = msg.value;
    }
    ctx.invalidator.invalidateSector(this.sectorId);
  }
}
