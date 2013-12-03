
import MU = require('../libs/mathutils');

class Intersection {
	public x:number;
	public side:boolean;

	constructor(x:number, side:boolean) {
		this.x = x;
    this.side = side;
	}
}

export class Segment {
  public x1:number;
  public x2:number;
  public y1:number;
  public y2:number;

  constructor(x1:number, y1:number, x2:number, y2:number) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }
}

function getIntersections(y:number, polygon:Segment[]):Intersection[] {
  var intersections:Intersection[] = [];
  for (var i = 0; i < polygon.length; i++) {
    var segment = polygon[i];
    var dy1 = segment.y1 - y;
    var dy2 = segment.y2 - y;
    if (dy1 == 0 || dy2 == 0)
        continue;
        
    if (MU.sign(dy1) != MU.sign(dy2)) {
        var d = dy1 / (segment.y1 - segment.y2);
        var x = segment.x1 + d * (segment.x1 - segment.x2);
        intersections.push(new Intersection(x, dy1 < 0));
    }
  }
  
  intersections.sort((i1:Intersection, i2:Intersection) => i1.x - i2.x);
  return intersections;
}


class Span {
  public xl:number;
  public xr:number;

  constructor(xl:number, xr:number) {
    this.xl = xl;
    this.xr = xr;
  }
}

function computeSpansNonZeroWinding(intersections:Intersection[]):Span[] {
  var spans:Span[] = [];
  var count = 0;
  var xl:number = null;
  for (var i = 0; i < intersections.length; i++) {
    var inter = intersections[i];
    var dcount = inter.side ? 1 : -1;
    if (count == 0 || count + dcount == 0) {
      if (xl != null) {
        spans.push(new Span(xl, inter.x));
        xl = null;
      } else {
        xl = inter.x;
      }
    }
    count += dcount;
  }
  return spans;
}

class BoundingBox {
  public minx:number;
  public miny:number;
  public maxx:number;
  public maxy:number;

  constructor(minx:number, miny:number, maxx:number, maxy:number) {
    this.minx = minx;
    this.miny = miny;
    this.maxx = maxx;
    this.maxy = maxy;
  }
}

function computeBoundingBox(polygon:Segment[]):BoundingBox {
  var bb = new BoundingBox(Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
  for (var i = 0; i < polygon.length; i++) {
    var seg = polygon[i];
    bb.maxx = Math.max(bb.maxx, seg.x1, seg.x2);
    bb.maxy = Math.max(bb.maxy, seg.y1, seg.y2);
    bb.minx = Math.min(bb.minx, seg.x1, seg.x2);
    bb.miny = Math.min(bb.miny, seg.y1, seg.y2);
  }
  return bb;
}

export class Pixel {
  public xi:number;
  public yi:number;
  public xf:number;
  public yf:number;

  constructor(xi:number, yi:number, xf:number, yf:number) {
    this.xi = xi;
    this.yi = yi;
    this.xf = xf;
    this.yf = yf;
  }

}

export function rasterize(polygon:Segment[], xres:number, yres:number):Pixel[] {
  var pixels:Pixel[] = [];

  var dx = 1 / xres;
  var dy = 1 / yres;
  var sx = dx / 2;
  var sy = dy / 2;
  var bb = computeBoundingBox(polygon);
  var yi = MU.int(bb.maxy / dy);
  var yf = yi * dy - sy;

  while (yf > bb.miny) {
    var spans = computeSpansNonZeroWinding(getIntersections(yf, polygon));
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var xi = MU.int(span.xl / dx);
      var xri = MU.int(span.xr / dx);
      while (xi <= xri) {
        var xf = sx + xi * dy;
        pixels.push(new Pixel(xi, yi, xf, yf));
        xi++;
      }
    }
    yi--;
    yf -= dy;
  }

  return pixels;
}


