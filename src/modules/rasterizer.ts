
import MU = require('../libs/mathutils');
import GLM = require('../libs_js/glmatrix');

export class Segment {
  public x1:number;
  public x2:number;
  public y1:number;
  public y2:number;

  public satrs:GLM.Vec3Array[];
  public eatrs:GLM.Vec3Array[];

  constructor(x1:number, y1:number, x2:number, y2:number, satrs:number[][], eatrs:number[][]);
  constructor(x1:number, y1:number, x2:number, y2:number, satrs:GLM.Vec3Array[], eatrs:GLM.Vec3Array[]) {
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.satrs = satrs;
    this.eatrs = eatrs;
  }
}

class Intersection {
	public x:number;
	public side:boolean;
  public segment:Segment;

	constructor(x:number, side:boolean, segment:Segment) {
		this.x = x;
    this.side = side;
    this.segment = segment;
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
        var x = segment.x1 + d * (segment.x2 - segment.x1);
        intersections.push(new Intersection(x, dy1 < 0, segment));
    }
  }
  
  intersections.sort((i1:Intersection, i2:Intersection) => i1.x - i2.x);
  return intersections;
}


class Span {
  public xl:number;
  public xr:number;
  public segl:Segment;
  public segr:Segment;

  constructor(xl:number, xr:number, segl:Segment, segr:Segment) {
    this.xl = xl;
    this.xr = xr;
    this.segl = segl;
    this.segr = segr;
  }
}

function computeSpansNonZeroWinding(intersections:Intersection[]):Span[] {
  var spans:Span[] = [];
  var count = 0;
  var xl:number = null;
  var segl:Segment = null;
  for (var i = 0; i < intersections.length; i++) {
    var inter = intersections[i];
    var dcount = inter.side ? 1 : -1;
    if (count == 0 || count + dcount == 0) {
      if (xl != null) {
        spans.push(new Span(xl, inter.x, segl, inter.segment));
        xl = null;
      } else {
        xl = inter.x;
        segl = inter.segment;
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
  public atrs:GLM.Vec3Array[]

  constructor(xi:number, yi:number, xf:number, yf:number, atrs:GLM.Vec3Array[]) {
    this.xi = xi;
    this.yi = yi;
    this.xf = xf;
    this.yf = yf;
    this.atrs = atrs;
  }

}

export function rasterize(polygon:Segment[], xres:number, yres:number):Pixel[] {
  var pixels:Pixel[] = [];

  var dx = 1 / xres;
  var dy = 1 / yres;
  var sx = dx / 2;
  var sy = dy / 2;
  var bb = computeBoundingBox(polygon);
  var yi = MU.int(bb.miny / dy);
  var yf = sy + yi * dy;

  while (yf <= bb.maxy) {
    var spans = computeSpansNonZeroWinding(getIntersections(yf, polygon));
    for (var i = 0; i < spans.length; i++) {
      var span = spans[i];
      var adyr = Math.abs((yf - span.segr.y1) / (span.segr.y1 - span.segr.y2));
      var adyl = Math.abs((yf - span.segl.y1) / (span.segl.y1 - span.segl.y2));
      var ratrs:GLM.Vec3Array[] = [];
      var latrs:GLM.Vec3Array[] = [];
      for(var a = 0; a < span.segl.satrs.length; a++) {
        ratrs[a] = GLM.vec3.lerp(GLM.vec3.create(), span.segr.satrs[a], span.segr.eatrs[a], adyr);
        latrs[a] = GLM.vec3.lerp(GLM.vec3.create(), span.segl.satrs[a], span.segl.eatrs[a], adyl);
      }

      var xi = MU.int(span.xl / dx);
      var xri = MU.int(span.xr / dx);
      while (xi <= xri) {
        var xf = sx + xi * dy;
        var adx = (xf - span.xl) / (span.xr - span.xl);
        var atrs:GLM.Vec3Array[] = [];
        for (var a = 0; a < ratrs.length; a++)
          atrs[a] = GLM.vec3.lerp(GLM.vec3.create(), latrs[a], ratrs[a], adx);
        pixels.push(new Pixel(xi, yi, xf, yf, atrs));
        xi++;
      }
    }
    yi++;
    yf += dy;
  }

  return pixels;
}


