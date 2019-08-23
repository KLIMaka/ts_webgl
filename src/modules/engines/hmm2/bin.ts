import data = require('../../../libs/stream');
import ICN = require('./icn');
import IU = require('../../../libs/imgutils');
import MU = require('../../../libs/mathutils');
import pixel = require('../../pixelprovider');

var shadow = new Uint8Array([0, 0, 0, 127]);

export interface IcnProvider {
  get(name: string): ICN.IcnFile;
}

export class BinFile {
  private goff: number;

  constructor(
    private data: data.Stream,
    private pal: Uint8Array) {
    this.goff = data.mark();
  }

  public render(icnProvider: IcnProvider): HTMLCanvasElement {
    var s = this.data;
    s.setOffset(this.goff);

    var w = s.readUShort();
    var h = s.readUShort();
    var type = s.readUShort();
    var canvas = IU.createEmptyCanvas(w, h);
    document.body.appendChild(canvas);
    this.parseParts(canvas, icnProvider);
    return canvas;
  }

  private parseParts(canvas: HTMLCanvasElement, icnProvider: IcnProvider): void {
    var s = this.data;
    for (; ;) {
      var type = s.readUShort();
      if (type == 0)
        return;
      switch (type) {
        case 0x01: {
          this.parseBg(canvas, icnProvider);
          break;
        }
        case 0x02: {
          this.parseButton(canvas, icnProvider);
          break;
        }
        case 0x08: {
          this.parseText(canvas, icnProvider);
          break;
        }
        case 0x10: {
          this.parseImg(canvas, icnProvider);
          break;
        }
        default:
          throw new Error('unknown type: ' + type);
      }
    }
  }

  private parseBg(canvas: HTMLCanvasElement, icnProvider: IcnProvider): void {
    var s = this.data;
    var xoff = s.readUShort();
    var yoff = s.readUShort();
    var w = s.readUShort();
    var h = s.readUShort();
    var unk = s.readUInt();
    if (unk != 134348799 && unk != 134283265 && unk != 134283264) {
      // var ctx = canvas.getContext("2d");
      // ctx.fillStyle = "#FF0000";
      // ctx.fillRect(xoff, yoff, xoff+w, yoff+h);
      s.skip(2);
      return;
    }
    var icnName = s.readByteString(13);
    var icn = icnProvider.get(icnName);
    var info = icn.getInfo(0);
    var bg = icn.getFrame(0);
    var pp: pixel.PixelProvider = new pixel.RGBPalPixelProvider(bg, this.pal, info.width, info.height, 255, 0, 1, shadow);
    IU.drawToCanvas(pp, canvas, xoff + info.offsetX, yoff + info.offsetY, pixel.BlendAlpha);
  }

  private parseButton(canvas: HTMLCanvasElement, icnProvider: IcnProvider): void {
    var s = this.data;
    var xoff = s.readUShort();
    var yoff = s.readUShort();
    var w = s.readUShort();
    var h = s.readUShort();
    var icnName = s.readByteString(13);
    var press = s.readUShort();
    var depress = s.readUShort();
    s.skip(8);
    var icn = icnProvider.get(icnName);
    var info = icn.getInfo(press);
    var frame = icn.getFrame(press);
    var pp: pixel.PixelProvider = new pixel.RGBPalPixelProvider(frame, this.pal, info.width, info.height, 255, 0, 1, shadow);
    IU.drawToCanvas(pp, canvas, xoff + info.offsetX, yoff + info.offsetY, pixel.BlendAlpha);
  }

  private parseText(canvas: HTMLCanvasElement, icnProvider: IcnProvider): void {
    var s = this.data;
    var xoff = s.readUShort();
    var yoff = s.readUShort();
    var w = s.readUShort();
    var h = s.readUShort();
    var len = s.readUShort();
    var str = s.readByteString(len);
    str = str.match(/^ *$/) ? 'test' : str;
    var fontName = s.readByteString(13);
    var unk1 = s.readUShort();
    var flags = s.readUShort();
    var unk2 = s.readUInt();

    var font = fontName == 'smalfont.fnt' ? 'SMALFONT.ICN' : 'FONT.ICN';
    var spaceSize = fontName == 'smalfont.fnt' ? 4 : 6;
    var icn = icnProvider.get(font);
    var txtLegth = 0;
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i) - 0x20;
      if (c == 0) {
        txtLegth += spaceSize;
        continue;
      }
      var info = icn.getInfo(c);
      txtLegth += info.width;
    }

    var x = xoff;
    if (flags == 1) {
      x = xoff + MU.int((w - txtLegth) / 2);;
    } else if (flags == 2) {
      x = xoff + w - txtLegth;
    }
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i) - 0x20;
      if (c == 0) {
        x += spaceSize;
        continue;
      }
      var info = icn.getInfo(c);
      var frame = icn.getFrame(c);
      var pp: pixel.PixelProvider = new pixel.RGBPalPixelProvider(frame, this.pal, info.width, info.height, 255, 0, 1, shadow);
      IU.drawToCanvas(pp, canvas, x, yoff + info.offsetY, pixel.BlendAlpha);
      x += info.width;
    }
  }

  private parseImg(canvas: HTMLCanvasElement, icnProvider: IcnProvider): void {
    var s = this.data;
    var xoff = s.readUShort();
    var yoff = s.readUShort();
    var w = s.readUShort();
    var h = s.readUShort();
    var icnName = s.readByteString(13);
    var idx = s.readUShort();
    var unk1 = s.readUShort();
    var flags = s.readUShort();
    var unk2 = s.readUInt();

    var icn = icnProvider.get(icnName);
    var info = icn.getInfo(idx);
    var frame = icn.getFrame(idx);
    var pp: pixel.PixelProvider = new pixel.RGBPalPixelProvider(frame, this.pal, info.width, info.height, 255, 0, 1, shadow);
    if (flags == 9)
      pp = pixel.xflip(pp);
    if (unk1 == 1) {
      xoff -= info.width + info.offsetX * 2 - 1;
      pp = pixel.xflip(pp);
    }
    if (unk2 == 17)
      pp = pixel.center(pp, w, h);
    IU.drawToCanvas(pp, canvas, xoff + info.offsetX, yoff + info.offsetY, pixel.BlendAlpha);
  }
}

export function create(data: data.Stream, pal: Uint8Array) {
  return new BinFile(data, pal);
}