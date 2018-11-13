
export var NONE = 0;
export var PENCIL = 1;
export var LINE = 2;

export class Painter {

  private mainSurface:Uint8Array;
  private mode:number = NONE;
  private x:number = 0;
  private y:number = 0;
  private isPenDown:boolean = false;

  constructor(
    private w:number,
    private h:number)
  {
    this.mainSurface = new Uint8Array(w*h);
  }

  public to(x:number, y:number):Painter {
    this.x = x;
    this.y = y;
    return this;
  }

  public penDown():Painter {
    this.isPenDown = true;
    return this;
  }

  public penUp():Painter {
    this.isPenDown = false;
    return this;
  }

}