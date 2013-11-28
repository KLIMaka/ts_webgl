
import MU = require('.../libs/mathutils');

class Intersection {
	public x:number;
	public side:boolean;

	constructor(x:number, side:boolean) {
		this.x = x;
    this.side = side;
	}
}

class Segment {
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
        
    if ((dy1 ^ dy2) < 0) {
        var d = dy2 / (segment.y1 - segment.y2);
        var x = segment.x1 + d*(segment.x1 - segment.x2);
        intersections.push(new Intersection(x, dy1 < 0));
    }
  }
  
  intersections.sort((i1:Intersection, i2:Intersection) => i1.x > i2.x);
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
