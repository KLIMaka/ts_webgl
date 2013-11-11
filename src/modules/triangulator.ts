import p2t = require('../libs_js/poly2tri');

function point(p:number[]):p2t.js.poly2tri.Point {
  return new p2t.js.poly2tri.Point(p[0], p[1]);
}

function getTriangles(tris:p2t.js.poly2tri.Triangle[]):number[][] {
  var ret:number[][] = new Array<number[]>(tris.length * 3);
  for (var i = 0; i < tris.length * 3; i += 3) {
    var tri = tris[i/3];
    ret[i + 0] = [tri.GetPoint(0).x, tri.GetPoint(0).y];
    ret[i + 1] = [tri.GetPoint(1).x, tri.GetPoint(1).y];
    ret[i + 2] = [tri.GetPoint(2).x, tri.GetPoint(2).y];
  }
  return ret;
}

export function triangulate(contour:number[][], holes:number[][][]):number[][] {
  var c:p2t.js.poly2tri.Point[] = new Array<p2t.js.poly2tri.Point>(contour.length);
  for (var i = 0; i < contour.length; i++)
    c[i] = point(contour[i]);
  var ctx = new p2t.js.poly2tri.SweepContext(c);
  for (var i = 0; i < holes.length; i++) {
    var hole = holes[i];
    var h:p2t.js.poly2tri.Point[] = new Array<p2t.js.poly2tri.Point>(hole.length);
    for (var j = 0; j < hole.length; j++)
      h[j] = point(hole[j]);
    ctx.AddHole(h);
  }
  p2t.js.poly2tri.sweep.Triangulate(ctx);
  return getTriangles(ctx.GetTriangles());
}

