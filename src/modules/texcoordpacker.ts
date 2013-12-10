
export class Rect {
  public width:number;
  public height:number;
  private xoff:number;
  private yoff:number;

  constructor(w:number, h:number, xoff:number = 0, yoff:number = 0) {
    this.width = w;
    this.height = h;
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

  public pack(w:number, h:number):Rect{
    if (this.sized) {
      var r = null;
      if (this.p1 != null)
        r = this.p1.pack(w,h);
      if (r == null && this.p2 != null)
        r = this.p2.pack(w,h);
      return r;
    } else {
      if (w <= this.width && h <= this.height) {
        r = new Rect(w ,h, this.xoff, this.yoff);
        this.sized = true;
        if (w != this.width) {
          this.p1 = new Packer(this.width - w, h, this.xoff+w, this.yoff);
        }
        if (h != this.height) {
          this.p2 = new Packer(this.width, this.height - h, this.xoff, this.yoff+h);
        }
        return r;
      }
      return null;
    }
  }
}