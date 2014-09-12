import data = require('../../../libs/dataviewstream');
import ICN = require('./icn');
import IU = require('../../../libs/imgutils');
import pixel = require('../../pixelprovider');

export interface IcnProvider {
  get():ICN.IcnFile;
}

export class BinFile {

  constructor(private data:data.DataViewStream) {
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

  private parsePart(canvas:HTMLCanvasElement, icnProvider:IcnProvider):void {
    var s = this.data;
    var type = s.readUShort();
    if (type == 0)
      return;
    switch (type)
    {
      case 0x01: {
        this.parseBg(canvas, icnProvider);
        return;
      }
    }
  }

  private parseBg(canvas:HTMLCanvasElement, icnProvider:IcnProvider):void {
    var s = this.data;
    var xoff = s.readUShort();
    var yoff = s.readUShort();
    var w = s.readUShort();
    var h = s.readUShort();
    var unk = s.readUint();
    var icnName = s.readByteString(13);
    var icn = icnProvider.get(icnName);
    var bginfo = icn.getInfo(0);
    var bg = icn.getFrame(0);
  }
}