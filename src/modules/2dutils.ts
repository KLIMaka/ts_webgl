import MU = require('../libs/mathutils');

export class PointView {
  constructor(
     private array:ArrayLike<number> 
  ){}

  public 
}

export class Point {
  constructor(
    public x:number,
    public y:number
  ){}
}

export class Rect {
  constructor(
    public x1:number,
    public y1:number,
    public x2:number,
    public y2:number
    ){}

  public width():number {
    return this.x2-this.x1;
  }

  public height():number {
    return this.y2-this.y1;
  }

  public move(dx:number, dy:number) {
    this.x1+=dx; this.x2+=dx;
    this.y1+=dy; this.y2+=dy;
  }
}

export class Grid {
  constructor(
    public cw:number,
    public ch:number,
    public w:number,
    public h:number
  ){}

  public cellId(id:number):Rect {
    return gridCellId(id, this.cw, this.ch, this.h, this.w);
  }

  public cellXY(x:number, y:number):Rect {
    return gridCellXY(x, y, this.cw, this.ch, this.h, this.w);
  }
}

export function gridCellId(id:number, cw:number, ch:number, w:number, h:number):Rect {
  var x = (MU.int(id%w))*cw;
  var y = (MU.int(id/w))*ch;
  return new Rect(x, y, x+cw, y+ch);
}

export function gridCellXY(x:number, y:number, cw:number, ch:number, w:number, h:number):Rect {
  return gridCellId(y*w+x, cw, ch, w, h);
}