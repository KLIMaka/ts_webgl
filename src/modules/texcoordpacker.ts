
export class Rect {
  public w:number;
  public h:number;
  public xoff:number;
  public yoff:number;

  constructor(w:number, h:number, xoff:number = 0, yoff:number = 0) {
    this.w = w;
    this.h = h;
    this.xoff = xoff;
    this.yoff = yoff;
  }
}

export class Packer {

  private p1:Packer;
  private p2:Packer;
  private width:number;
  private height:number;
  private xoff:number;
  private yoff:number;
  private sized = false;

  constructor(w:number, h:number, xoff:number = 0, yoff:number = 0) {
    this.width = w;
    this.height = h;
    this.xoff = xoff;
    this.yoff = yoff;
  }

  public pack(rect:Rect):Rect{
    if (this.sized) {
      var r = null;
      if (this.p1 != null)
        r = this.p1.pack(rect);
      if (r == null && this.p2 != null)
        r = this.p2.pack(rect);
      return r;
    } else {
      if (rect.w <= this.width && rect.h <= this.height) {
        rect.xoff = this.xoff; rect.yoff = this.yoff;
        this.sized = true;
        if (rect.w != this.width) {
          this.p1 = new Packer(this.width - rect.w, rect.h, this.xoff+rect.w, this.yoff);
        }
        if (rect.h != this.height) {
          this.p2 = new Packer(this.width, this.height - rect.h, this.xoff, this.yoff+rect.h);
        }
        return rect;
      }
      return null;
    }
  }
}

export class Hull {
  constructor(
    public minx:number,
    public maxx:number,
    public miny:number,
    public maxy:number)
  {}
}

export function getHull(vtxs:number[][]):Hull {
  var maxx = vtxs[0][0];
  var maxy = vtxs[0][1];
  var minx = vtxs[0][0];
  var miny = vtxs[0][1];
  for (var i = 0; i < vtxs.length; i++) {
    var vtx = vtxs[i];
    if (vtx[0] < minx) minx = vtx[0];
    if (vtx[0] > maxx) maxx = vtx[0];
    if (vtx[1] < miny) miny = vtx[1];
    if (vtx[1] > maxy) maxy = vtx[1];
  }
  return new Hull(minx, maxx, miny, maxy);
}
