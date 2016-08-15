
import P = require('../pixelprovider');
import MU = require('../../libs/mathutils');
import IU = require('../../libs/imgutils');

import PixelProvider = P.PixelProvider;

export class PixelDataProvider {

  constructor(
    private s:number,
    private f:(i:number) => PixelProvider
  ) {}

  public size():number {
    return this.s;
  }

  public get(i:number):PixelProvider {
    return this.f(i);
  }
}

var noneImg = new Uint8Array([
  1, 1, 1, 1, 1, 1, 1, 1, 
  1, 1, 0, 0, 0, 0, 1, 1, 
  1, 0, 1, 0, 0, 1, 0, 1, 
  1, 0, 0, 1, 1, 0, 0, 1, 
  1, 0, 0, 1, 1, 0, 0, 1, 
  1, 0, 1, 0, 0, 1, 0, 1, 
  1, 1, 0, 0, 0, 0, 1, 1, 
  1, 1, 1, 1, 1, 1, 1, 1, 
]);

var nonePal = new Uint8Array([
  255, 255, 255,
  255,   0,   0
]);
var noneProvider = P.fromPal(noneImg, nonePal, 8, 8);

export class DrawPanel {

  private cellW:number;
  private cellH:number;
  private firstId = 0;

  constructor(
    private canvas:HTMLCanvasElement,
    private provider:PixelDataProvider
  ) {}

  public setCellSize(w:number, h:number):void {
    this.cellW = w;
    this.cellH = h;
  }

  public setFirstId(id:number):void {
    this.firstId = id;
  }

  public nextPage():void {
    var cells = MU.int(this.canvas.width / this.cellW) * MU.int(this.canvas.height / this.cellH);
    if (this.firstId + cells >= this.provider.size())
      return;
    this.firstId += cells;
  }

  public prevPage():void {
    var cells = MU.int(this.canvas.width / this.cellW) * MU.int(this.canvas.height / this.cellH);
    if (this.firstId - cells < 0)
      return;
    this.firstId -= cells;
  }

  public draw():void {
    var provider = this.provider;
    var canvas = this.canvas;
    var w = canvas.width;
    var h = canvas.height;
    var ctx = canvas.getContext('2d');
    var wcells = MU.int(w / this.cellW);
    var hcells = MU.int(h / this.cellH);
    var cells = wcells * hcells;
    var firstId = this.firstId;
    var lastId = Math.min(firstId + cells, provider.size());

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, w ,h);

    for (var i = firstId; i < lastId; i++) {
      var x = ((i-firstId) % wcells) * this.cellW;
      var y = MU.int((i-firstId) / wcells) * this.cellH;
      var img = provider.get(i);
      if (img == null)
        img = noneProvider;
      var pixels = P.fit(this.cellW, this.cellH, img, [255, 255, 255, 255]);
      IU.drawToCanvas(pixels, canvas, x ,y);
    }
  }

}