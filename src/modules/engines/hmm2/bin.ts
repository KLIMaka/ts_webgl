import data = require('../../../libs/dataviewstream');
import ICN = require('./icn');
import IU = require('../../../libs/imgutils');
import pixel = require('../../pixelprovider');

var shadow = [0, 0, 0, 127];

export interface IcnProvider {
  get():ICN.IcnFile;
}

export class BinFile {

  constructor(private data:data.DataViewStream, private pal:Uint8Array) {
    this.goff = data.mark();
  }

  public render(icnProvider:IcnProvider):Uint8Array {
    var s = this.data;
    s.setOffset(this.goff);

    var w = s.readUShort();
    var h = s.readUShort();
    var type = s.readUShort();
    var canvas = UI.createEmptyCanvas(w, h);
    this.parsePart(canvas, icnProvider);
  }

  private parseParts(canvas:HTMLCanvasElement, icnProvider:IcnProvider):void {
    var s = this.data;
    for (;;) {
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
      }
    }
  }

  private parseBg(canvas:HTMLCanvasElement, icnProvider:IcnProvider):void {
    var s = this.data;
    var xoff = s.readUShort();
    var yoff = s.readUShort();
    var w = s.readUShort();
    var unk = s.readUint();
    var icnName = s.readByteString(13);
    var icn = icnProvider.get(icnName);
    var info = icn.getInfo(0);
    var bg = icn.getFrame(0);
    var pp:pixel.PixelProvider = new pixel.RGBPalPixelProvider(bg, this.pal, info.width, info.height, 255, 0, 1, shadow);
    pp = pixel.rect(pp, 0, 0, w, h);
    IU.drawToCanvas(pp, canvas, xoff, yoff);
  }

  private parseButton(canvas:HTMLCanvasElement, icnProvider:IcnProvider):void {
    var s = this.data;
    var h = s.readUShort();
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
    var pp:pixel.PixelProvider = new pixel.RGBPalPixelProvider(frame, this.pal, info.width, info.height, 255, 0, 1, shadow);
    pp = pixel.rect(pp, 0, 0, w, h);
    IU.drawToCanvas(pp, canvas, xoff, yoff);
  }
}