import { DrawPanel, PixelDataProvider } from "../../ui/drawpanel";
import { ArtInfoProvider } from "./art";
import { RGBPalPixelProvider, axisSwap } from "../../pixelprovider";
import { Element, panel, button, dragElement, div } from "../../ui/ui";

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
    let frame = div('frame');
    let header = div('header').text('Tiles');
    header.append(button('<').click(() => { this.drawPanel.prevPage(); this.drawPanel.draw(); }));
    header.append(button('>').click(() => { this.drawPanel.nextPage(); this.drawPanel.draw(); }));
    header.append(button('x').click(() => this.select(-1)));
    frame.append(header).append(div('hline'));

    this.panel = frame;
    this.panel.pos('100', '100');
    let canvas: HTMLCanvasElement = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    this.drawPanel = createDrawPanel(arts, pal, canvas, (id: number) => this.select(id));
    this.drawPanel.setCellSize(64, 64);
    this.panel.append(new Element(canvas));
    this.hide();
    document.body.appendChild(this.panel.elem());
    dragElement(header.elem(), this.panel.elem());
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