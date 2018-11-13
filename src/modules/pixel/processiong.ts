
export interface Rect {
  width():number;
  height():number;
}

export type ImageReader = <P>(x:number, y:number, p:P) => void;
export type ImageWriter = <P>(x:number, y:number, p:P) => void;

export interface Algebra <P>{
  createPixel():P;
  scale(s:number, i:P, o:P):void;
  add(l:P, r:P, o:P):void;
  sub(l:P, r:P, o:P):void;
  blend(l:P, r:P, t:number, o:P):void;
}

export type Convolution = <P>(a:Algebra<P>, i:ImageReader, x:number, y:number, o:P) => void;

function convolute <P> (a:Algebra<P>, irect:Rect, i:ImageReader, o:ImageWriter, c:Convolution) {
  var p = a.createPixel(); 
  for (var y = 0; y < irect.height(); y++) {
    for (var x = 0; x < irect.width(); x++) {
      c(a, i, x, y, p);
      o(x, y, p);
    }
  }
}

export class RgbPixel {
  constructor(public r:number, public g:number, public b:number){}
}

export class RgbAlgebra implements Algebra<RgbPixel> {
  createPixel() {return new RgbPixel(0,0,0) }
  scale(s:number, i:RgbPixel, o:RgbPixel) { o.r = s*i.r; o.g = s*i.g; o.b = s*i.b; }
  add(r:RgbPixel, l:RgbPixel, o:RgbPixel) { o.r = l.r+r.r; o.g = l.g+r.g; o.b = l.b+r.b; }
  sub(r:RgbPixel, l:RgbPixel, o:RgbPixel) { o.r = l.r-r.r; o.g = l.g-r.g; o.b = l.b-r.b; }
  blend(l:RgbPixel, r:RgbPixel, t:number, o:RgbPixel) { o.r = l.r + (r.r-l.r)*t; o.g = l.g + (r.g-l.g)*t; o.b = l.b + (r.b-l.b)*t; };
}

export var BoxConvolution = <P> (a:Algebra<P>, i:ImageReader, x:number, y:number, o:P) => {
  var tmp = a.createPixel();
  for (var dx = -1; dx <= 1; dx++) {
    for (var dy = -1; dy <= 1; dy++) {
      i(x+dx, y+dy, tmp);
      a.add(o, tmp, o);
    }
  }
  a.scale(1/9, o, o);
}