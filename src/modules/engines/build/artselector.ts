import { DrawPanel, PixelDataProvider } from "../../ui/drawpanel";
import { ArtInfoProvider } from "./art";
import { RGBPalPixelProvider, axisSwap } from "../../pixelprovider";
import { Element, panel, button } from "../../ui/ui";

function createDrawPanel(arts: ArtInfoProvider, pal: Uint8Array, canvas: HTMLCanvasElement, cb: SelectionCallback) {
  let provider = new PixelDataProvider(4096, (i: number) => {
    let info = arts.getInfo(i);
    if (info == null) return null;
    return axisSwap(new RGBPalPixelProvider(info.img, pal, info.h, info.w));
  });
  return new DrawPanel(canvas, provider, cb);
}

export type SelectionCallback = (id: number) => void;

export class Selector {
  private panel: Element;
  private drawPanel: DrawPanel;
  private cb: SelectionCallback;

  constructor(w: number, h: number, arts: ArtInfoProvider, pal: Uint8Array) {
    this.panel = panel('Tiles');
    this.panel.pos('100', '100');
    let canvas: HTMLCanvasElement = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    this.drawPanel = createDrawPanel(arts, pal, canvas, (id: number) => this.select(id));
    this.drawPanel.setCellSize(64, 64);
    this.panel.append(new Element(canvas));
    let prev = button('<');
    prev.elem().onclick = (e: MouseEvent) => { this.drawPanel.prevPage(); this.drawPanel.draw(); }
    let next = button('>');
    next.elem().onclick = (e: MouseEvent) => { this.drawPanel.nextPage(); this.drawPanel.draw(); }
    let close = button('x');
    close.elem().onclick = (e: MouseEvent) => this.select(-1)
    this.panel.append(prev);
    this.panel.append(next);
    this.panel.append(close);
    this.hide();
    document.body.appendChild(this.panel.elem());
  }

  public show() {
    this.panel.css('display', 'block');
    this.drawPanel.draw();
  }

  public hide() {
    this.panel.css('display', 'none');
  }

  public modal(cb: SelectionCallback) {
    this.cb = cb;
    this.show();
  }

  private select(id: number) {
    this.hide();
    if (this.cb == null) return;
    let cb = this.cb;
    this.cb = null;
    cb(id);
  }
}