
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

export class TexturePixelProvider {

  private w:number;
  private h:number;
  private data:Uint8ClampedArray;

  constructor(tex) {
    var texcanvas = document.createElement('canvas');
    texcanvas.width = tex.width;
    texcanvas.height = tex.height;
    var texctx = texcanvas.getContext("2d");
    texctx.drawImage(tex, 0, 0);
    var texData = texctx.getImageData(0, 0, tex.width, tex.height);
    this.data = texData.data;
    this.w = tex.width;
    this.h = tex.height;
  }

  public get(u:number, w:number):number[] {
    var x = u * this.w;
    var y = w * this.h
    var xf = x % 1;
    var yf = y % 1;
    var xi = MU.int(x);
    var yi = MU.int(y);

    var x1 = xf < 0.5 ? xi - 1 : xi;
    var x2 = xf < 0.5 ? xi : xi + 1;
    var y1 = yf < 0.5 ? yi - 1 : yi;
    var y2 = yf < 0.5 ? yi : yi + 1;

    var off11 = this.getOffset(x1, y1);
    var off12 = this.getOffset(x1, y2);
    var off21 = this.getOffset(x2, y1);
    var off22 = this.getOffset(x2, y2);

    return this.calc(x, y, x1, x2, y1, y2, off11, off21, off12, off22);
  }

  private getOffset(x:number, y:number) {
    x = this.fixX(x);
    y = this.fixY(y);
    return (x*this.w+y)*4;
  }

  private calc(x:number, y:number, x1:number, x2:number, y1:number, y2:number, v11:number, v21:number, v12:number, v22:number) {
    var d = this.data;
    var wx1 = (x2+0.5-x);
    var wy1 = (y2+0.5-y);
    var wx2 = 1-wx1;
    var wy2 = 1-wy1;
    var w11 = wx1*wy1;
    var w12 = wx1*wy2;
    var w21 = wx2*wy1;
    var w22 = wx2*wy2;

    return [
      d[v11+0]*w11 + d[v21+0]*w21 + d[v12+0]*w12 + d[v22+0]*w22,
      d[v11+1]*w11 + d[v21+1]*w21 + d[v12+1]*w12 + d[v22+1]*w22, 
      d[v11+2]*w11 + d[v21+2]*w21 + d[v12+2]*w12 + d[v22+2]*w22, 
      d[v11+3]*w11 + d[v21+3]*w21 + d[v12+3]*w12 + d[v22+3]*w22 
    ];
  }

  private fixX(x:number):number {
    if (x < 0)
      return 0;
    if (x >= this.w)
      return this.w-1;
    return x;
  }

  private fixY(y:number):number {
    if (y < 0)
      return 0;
    if (y >= this.h)
      return this.h-1;
    return y;
  }
}

function blend(src:Uint8Array, off:number, dst:number[]) {
  var a = dst[3] / 256;
  var b = 1 - a;
  src[off+0] = src[off+0]*b + dst[0]*a;
  src[off+1] = src[off+1]*b + dst[1]*a;
  src[off+2] = src[off+2]*b + dst[2]*a;
  src[off+3] = 255;
}

export class Rasterizer {

  private img:Uint8Array;
  private shader:(a:number[])=>number[];
  private w:number;
  private h:number;
  private dx:number;
  private dy:number;
  private sx:number;
  private sy:number;

  private reg:number[][];

  private attrs:number[][] = [];
  private attrparams:BufferParams[] = [];

  private texs:ImageData[] = [];

  constructor(img:Uint8Array, w:number, h:number, shader:(a:number[])=>number[]) {
    this.shader = shader;
    this.img = img;
    this.w = w;
    this.h = h;
    this.dx = 1 / w;
    this.dy = 1 / h;
    this.sx = this.dx / 2;
    this.sy = this.dy / 2;
  }

  public bindAttribute(id:number, buf:number[], offset:number, stride:number):void {
    this.attrs[id] = buf;
    this.attrparams[id] = new BufferParams(offset, stride);
  }

  public bindAttributes(startid:number, buf:number[], numattrs:number):void {
    for (var i = 0; i < numattrs; i++)
      this.bindAttribute(startid + i, buf, i, numattrs);
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

  public clear(color:number[], d:number):void {
    var _d = 1 - d;
    var data = this.img;
    for (var i = 0; i < data.length; i+=4) {
      data[i+0] = data[i+0]*d + color[0]*_d;
      data[i+1] = data[i+1]*d + color[1]*_d;
      data[i+2] = data[i+2]*d + color[2]*_d;
      data[i+3] = data[i+3]*d + color[3]*_d;
    }
  }

  public *drawTriangles(indices:number[], start:number=0, length:number=indices.length):IterableIterator<number[]> {
    var dx = this.dx;
    var dy = this.dy;
    var sx = this.sx;
    var sy = this.sy;
    var numattrs = this.attrs.length;

    this.reg = this.allocateRegisters(3);
    var reg = this.reg;
    var ratrs = new Array<number>(numattrs);
    var latrs = new Array<number>(numattrs);
    var atrs = new Array<number>(numattrs);
    var polygon = [[0, 1], [1, 2], [2, 0]];
    var data = this.img;
    var intersect = new TriIntersection();
    var end = start + length;

    for (var i = start; i < end; i++) {

      for (var a = 0; a < numattrs; a++) {
        var param = this.attrparams[a];
        reg[i%3][a] = this.attrs[a][param.offset + indices[i] * param.stride];
      }
      if ((i+1) % 3 != 0)
        continue;

      var bb = this.computeBoundingBox(polygon);
      var miny = bb.miny > 1.0 ? 1.0 : bb.miny < 0.0 ? 0.0 : bb.miny;
      var maxy = bb.maxy > 1.0 ? 1.0 : bb.maxy < 0.0 ? 0.0 : bb.maxy;
      var yi = MU.int((miny+sy) / dy);
      var yf = sy + yi * dy;

      while (yf <= maxy) {
        intersect.reset();
        intersect = this.getIntersectionsTri(yf, intersect);
        if (intersect.hasIntersections()) {
          var r1 = reg[polygon[intersect.segr][0]];
          var r2 = reg[polygon[intersect.segr][1]];
          var l1 = reg[polygon[intersect.segl][0]];
          var l2 = reg[polygon[intersect.segl][1]];
        
          var adyr = Math.abs((yf - r1[1]) / (r1[1] - r2[1]));
          var adyl = Math.abs((yf - l1[1]) / (l1[1] - l2[1]));

          for(var a = 0; a < numattrs; a++) {
            ratrs[a] = r1[a] + (r2[a] - r1[a]) * adyr;
            latrs[a] = l1[a] + (l2[a] - l1[a]) * adyl;
          }

          var minx = intersect.xl;
          var maxx = intersect.xr;
          minx = minx > 1.0 ? 1.0 : minx < 0.0 ? 0.0 : minx;
          maxx = maxx > 1.0 ? 1.0 : maxx < 0.0 ? 0.0 : maxx;

          var xi = MU.int((minx+sx) / dx);
          var xf = sx + xi * dy;
          while (xf <= maxx) {
            var adx = (xf - intersect.xl) / (intersect.xr - intersect.xl);
            for (var a = 0; a < ratrs.length; a++)
              atrs[a] = latrs[a] + (ratrs[a] - latrs[a]) * adx;

            var px = this.shader(atrs);
            yield px;
            
            var off = (yi * this.w + xi)*4;
            blend(data, off, px);
            xi++;
            xf += dx;
          }
        }

        yi++;
        yf += dy;
      }
    }
  }
}



