
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
  constructor(public minx:number, public miny:number, public maxx:number, public maxy:number) {}
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
  public attrs:number[];

  constructor(xi:number, yi:number, xf:number, yf:number, attrs:number[]) {
    this.xi = xi;
    this.yi = yi;
    this.xf = xf;
    this.yf = yf;
    this.attrs = attrs;
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
        // pixels.push(new Pixel(xi, yi, xf, yf, atrs));
        xi++;
      }
    }
    yi++;
    yf += dy;
  }

  return pixels;
}

class BufferParams {
  constructor(public offset:number, public stride:number) {}
}

class BuffIntersection {
  constructor(public x:number, public side:boolean, public seg:number) {}
}

class TriIntersection {
  public xl:number = 0;
  public xr:number = 0;
  public segl:number = 0;
  public segr:number = 0;

  public addIntersect(x:number, seg:number):void {
    if (this.xl == null) {
      this.xl = x;
      this.segl = seg;
    } else if (this.xl > x) {
      this.xr = this.xl;
      this.segr = this.segl;
      this.xl = x;
      this.segl = seg;
    } else {
      this.xr = x;
      this.segr = seg;
    }
  }

  public reset():void {
    this.xl = null;
  }

  public hasIntersections():boolean {
    return this.xl != null;
  }
}

export class Rasterizer {

  private img:ImageData;
  private shader:(Pixel)=>number[];
  private w:number;
  private h:number;
  private dx:number;
  private dy:number;
  private sx:number;
  private sy:number;

  private reg:number[][];

  private attrs:number[][] = [];
  private attrparams:BufferParams[] = [];

  constructor(img:ImageData, shader:(Pixel)=>number[]) {
    this.shader = shader;
    this.img = img;
    this.w = img.width;
    this.h = img.height;
    this.dx = 1 / img.width;
    this.dy = 1 / img.height;
    this.sx = this.dx / 2;
    this.sy = this.dy / 2;
  }

  public bindAttribute(id:number, buf:number[], offset:number, stride:number):void {
    this.attrs[id] = buf;
    this.attrparams[id] = new BufferParams(offset, stride);
  }

  private computeBoundingBox(polygon:number[][]):BoundingBox {
    var bb = new BoundingBox(Number.MAX_VALUE, Number.MAX_VALUE, Number.MIN_VALUE, Number.MIN_VALUE);
    var reg = this.reg;

    for (var i = 0; i < polygon.length; i++) {
      var v1 = reg[polygon[i][0]];
      var v2 = reg[polygon[i][1]];
      bb.maxx = Math.max(bb.maxx, v1[0], v2[0]);
      bb.maxy = Math.max(bb.maxy, v1[1], v2[1]);
      bb.minx = Math.min(bb.minx, v1[0], v2[0]);
      bb.miny = Math.min(bb.miny, v1[1], v2[1]);
    }
    return bb;
  }

  private getIntersectionsTri(y:number, inter:TriIntersection):TriIntersection {
    var reg = this.reg;
    for (var i = 0; i < 3; i++) {
      var v1 = reg[i];
      var v2 = reg[i == 2 ? 0 : i+1];

      var dy1 = v1[1] - y;
      var dy2 = v2[1] - y;
      if (dy1 == 0 || dy2 == 0)
          continue;
          
      if (MU.sign(dy1) != MU.sign(dy2)) {
          var d = dy1 / (v1[1] - v2[1]);
          var x = v1[0] + d * (v2[0] - v1[0]);
          inter.addIntersect(x, i);
      }
    }
    
    return inter;
  }

  private allocateRegisters(numverts:number):number[][] {
    var reg = new Array<number[]>(numverts);
    var numattrs = this.attrs.length;
    for (var i = 0; i < numverts; i++) {
      reg[i] = new Array<number>(numattrs);
    }
    return reg;
  }

  public drawTriangles(indices:number[]):void {
    var dx = this.dx;
    var dy = this.dy;
    var sx = this.sx;
    var sy = this.sy;
    var numattrs = this.attrs.length;

    this.reg = this.allocateRegisters(3);
    var reg = this.reg;
    var polygon = [[0, 1], [1, 2], [2, 0]];

    for (var i = 0; i < indices.length; i++) {

      for (var a = 0; a < numattrs; a++) {
        var param = this.attrparams[a];
        reg[i%3][a] = this.attrs[a][param.offset + indices[i] * param.stride];
      }
      if ((i+1) % 3 != 0)
        continue;

      var bb = this.computeBoundingBox(polygon);
      var yi = MU.int(bb.miny / dy);
      var yf = sy + yi * dy;
      var intersect = new TriIntersection();

      while (yf <= bb.maxy) {
        intersect.reset();
        intersect = this.getIntersectionsTri(yf, intersect);
        if (intersect.hasIntersections()) {
          var r1 = reg[polygon[intersect.segr][0]];
          var r2 = reg[polygon[intersect.segr][1]];
          var l1 = reg[polygon[intersect.segl][0]];
          var l2 = reg[polygon[intersect.segl][1]];
        
          var adyr = Math.abs((yf - r1[1]) / (r1[1] - r2[1]));
          var adyl = Math.abs((yf - l1[1]) / (l1[1] - l2[1]));
          var ratrs = new Array<number>(numattrs);
          var latrs = new Array<number>(numattrs);
          for(var a = 0; a < numattrs; a++) {
            ratrs[a] = r1[a] + (r2[a] - r1[a]) * adyr;
            latrs[a] = l1[a] + (l2[a] - l1[a]) * adyl;
          }

          var xi = MU.int(intersect.xl / dx);
          var xri = MU.int(intersect.xr / dx);
          while (xi <= xri) {
            var xf = sx + xi * dy;
            if (xf < intersect.xl)
              xf = intersect.xl;
            var adx = (xf - intersect.xl) / (intersect.xr - intersect.xl);
            var atrs = new Array<number>(numattrs);
            for (var a = 0; a < ratrs.length; a++)
              atrs[a] = latrs[a] + (ratrs[a] - latrs[a]) * adx;
            var px = this.shader(new Pixel(xi, yi, xf, yf, atrs));
            var off = (yi * this.w + xi)*4;
            this.img.data[off + 0] = px[0];
            this.img.data[off + 1] = px[1];
            this.img.data[off + 2] = px[2];
            this.img.data[off + 3] = px[3];
            xi++;
          }
        }

        yi++;
        yf += dy;
      }
    }
  }
}



