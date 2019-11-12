import { Element, span, Table } from "../../ui/ui";
import { BuildContext } from "./api";
import { MessageHandlerReflective } from "./handlerapi";
import { Hitscan, isSector, isSprite, isWall, SubType } from "./hitscan";
import { Frame } from "./edit/messages";

export class Info extends MessageHandlerReflective {
  private wallTable: Element;
  private wallFields: { [index: string]: Element } = {};
  private sectorTable: Element;
  private sectorFields: { [index: string]: Element } = {};

  constructor() {
    super();
    this.prepareWallTable();
    this.prepareSectorTable();
  }

  public Frame(msg: Frame, ctx: BuildContext) {
    let hit = ctx.state.get<Hitscan>('hitscan');
    this.clear();
    if (isWall(hit.type)) this.renderWall(ctx, hit.id);
    else if (isSector(hit.type)) this.renderSector(ctx, hit.id, hit.type);
    else if (isSprite(hit.type)) this.renderSprite(ctx, hit.id);
  }

  private clear() {
    this.wallTable.css('display', 'none');
    this.sectorTable.css('display', 'none');
  }

  private renderSprite(ctx: BuildContext, id: number) {
  }

  private renderSector(ctx: BuildContext, id: number, type: SubType) {
    this.sectorTable.css('display', '');
    let sector = ctx.board.sectors[id];
    this.sectorFields['id'].text(`${id}`);
    if (type == SubType.CEILING) {
      this.sectorFields['panning'].text(`${sector.ceilingxpanning}, ${sector.ceilingypanning}`);
      this.sectorFields['shade'].text(`${sector.ceilingshade}`);
      this.sectorFields['picnum'].text(`${sector.ceilingpicnum}`);
      this.sectorFields['pal'].text(`${sector.ceilingpal}`);
    } else {
      this.sectorFields['panning'].text(`${sector.floorxpanning}, ${sector.floorypanning}`);
      this.sectorFields['shade'].text(`${sector.floorshade}`);
      this.sectorFields['picnum'].text(`${sector.floorpicnum}`);
      this.sectorFields['pal'].text(`${sector.floorpal}`);
    }
  }

  private renderWall(ctx: BuildContext, id: number) {
    this.wallTable.css('display', '');
    let wall = ctx.board.walls[id];
    this.wallFields['id'].text(`${id}`);
    this.wallFields['panning'].text(`${wall.xpanning}, ${wall.ypanning}`);
    this.wallFields['repeat'].text(`${wall.xrepeat}, ${wall.yrepeat}`);
    this.wallFields['shade'].text(`${wall.shade}`);
    this.wallFields['picnum'].text(`${wall.picnum}`);
    this.wallFields['pal'].text(`${wall.pal}`);
  }

  private prepareWallTable() {
    let table = this.wallTable = new Table();
    table.className("table-striped");
    table.css('display', 'none');
    table.row([span().text('Type'), span().text('Wall')]);
    this.wallFields['id'] = span();
    this.wallFields['panning'] = span();
    this.wallFields['repeat'] = span();
    this.wallFields['shade'] = span();
    this.wallFields['picnum'] = span();
    this.wallFields['pal'] = span();
    table.row([span().text("Id"), this.wallFields['id']]);
    table.row([span().text("Picnum"), this.wallFields['picnum']]);
    table.row([span().text("Shade"), this.wallFields['shade']]);
    table.row([span().text("Palette"), this.wallFields['pal']]);
    table.row([span().text("Panning"), this.wallFields['panning']]);
    table.row([span().text("Repeat"), this.wallFields['repeat']]);
    document.getElementById('info_panel').appendChild(table.elem());
  }

  private prepareSectorTable() {
    let table = this.sectorTable = new Table();
    table.className("table-striped");
    table.css('display', 'none');
    table.row([span().text('Type'), span().text('Sector')]);
    this.sectorFields['id'] = span();
    this.sectorFields['panning'] = span();
    this.sectorFields['shade'] = span();
    this.sectorFields['picnum'] = span();
    this.sectorFields['pal'] = span();
    table.row([span().text("Id"), this.sectorFields['id']]);
    table.row([span().text("Picnum"), this.sectorFields['picnum']]);
    table.row([span().text("Shade"), this.sectorFields['shade']]);
    table.row([span().text("Palette"), this.sectorFields['pal']]);
    table.row([span().text("Panning"), this.sectorFields['panning']]);
    document.getElementById('info_panel').appendChild(table.elem());
  }
}