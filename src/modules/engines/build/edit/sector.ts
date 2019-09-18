import * as GLM from "../../../../libs_js/glmatrix";
import { isSector, SubType } from "../hitscan";
import { MessageHandlerIml } from "../messages";
import { heinumCalc, sectorZ, setSectorHeinum, setSectorPicnum, setSectorZ, ZSCALE } from "../utils";
import { BuildContext, Highlight, Move, SetPicnum, StartMove, ToggleParallax, Shade, PanRepeat, Palette } from "./editapi";
import { cyclic } from "../../../../libs/mathutils";
import { invalidateSectorAndWalls } from "./editutils";

export class SectorEnt extends MessageHandlerIml {

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
    let x = msg.handle.hit.x;
    let y = msg.handle.hit.y;
    // let sec = ctx.board.sectors[this.sectorId];
    // let slope = createSlopeCalculator(sec, ctx.board.walls);
    // this.originz = slope(x, y, this.type == HitType.CEILING ? sec.ceilingheinum : sec.floorheinum) + sectorZ(ctx.board, this.sectorId, this.type)) / ZSCALE;
    this.originz = sectorZ(ctx.board, this.sectorId, this.type) / ZSCALE;
    GLM.vec2.set(this.origin, x, y);
  }

  public Move(msg: Move, ctx: BuildContext) {
    if (!msg.handle.mod2)
      return;
    if (msg.handle.mod1) {
      let x = this.origin[0];
      let y = this.origin[1];
      let z = ctx.snap(this.originz + msg.handle.dz() * ZSCALE);
      let h = heinumCalc(ctx.board, this.sectorId, x, y, z);
      if (setSectorHeinum(ctx.board, this.sectorId, this.type, h))
        invalidateSectorAndWalls(this.sectorId, ctx);
    } else {
      let z = isSector(msg.handle.hit.type) && msg.handle.hit.id != this.sectorId
        ? sectorZ(ctx.board, msg.handle.hit.id, msg.handle.hit.type) / ZSCALE
        : ctx.snap(this.originz + msg.handle.dz());
      if (setSectorZ(ctx.board, this.sectorId, this.type, z * ZSCALE))
        invalidateSectorAndWalls(this.sectorId, ctx);
    }
  }

  public Highlight(msg: Highlight, ctx: BuildContext) {
    let r = ctx.helpers.sector(this.sectorId)
    msg.list.push(this.type == SubType.CEILING ? r.ceiling : r.floor);
  }

  public SetPicnum(msg: SetPicnum, ctx: BuildContext) {
    if (setSectorPicnum(ctx.board, this.sectorId, this.type, msg.picnum))
      ctx.invalidateSector(this.sectorId);
  }

  public ToggleParallax(msg: ToggleParallax, ctx: BuildContext) {
    let sector = ctx.board.sectors[this.sectorId];
    let stat = this.type == SubType.CEILING ? sector.ceilingstat : sector.floorstat;
    stat.parallaxing = stat.parallaxing == 1 ? 0 : 1;
    ctx.invalidateSector(this.sectorId);
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
    ctx.invalidateSector(this.sectorId);
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
    ctx.invalidateSector(this.sectorId);
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
    ctx.invalidateSector(this.sectorId);
  }
}
