/// <reference path="../defs/nodeunit.d.ts"/>

import poly2tri = require('../libs/poly2tri');

function point(x:number, y:number):poly2tri.js.poly2tri.Point {
  return new poly2tri.js.poly2tri.Point(x,y);
}

function printTriangles(tris:poly2tri.js.poly2tri.Triangle[]):void {
  for(var i = 0; i < tris.length; i++) {
    var tri = tris[i];
    var str = '[' + tri.GetPoint(0).x + ' ' + tri.GetPoint(0).y + ']';
    str += '[' + tri.GetPoint(1).x + ' ' + tri.GetPoint(1).y + ']';
    str += '[' + tri.GetPoint(2).x + ' ' + tri.GetPoint(2).y + ']';
    console.log(str);
  }
}

export function test(test:nodeunit.Test) {
  var points:poly2tri.js.poly2tri.Point[] = [];
  points.push(point(0, 0));
  points.push(point(0, 1));
  points.push(point(1, 1));
  points.push(point(1, 0));
  var hole:poly2tri.js.poly2tri.Point[] = [];
  hole.push(point(0.2, 0.2));
  hole.push(point(0.4, 0.2));
  hole.push(point(0.4, 0.4));
  hole.push(point(0.2, 0.4));
  var ctx = new poly2tri.js.poly2tri.SweepContext(points);
  ctx.AddHole(hole);
  poly2tri.js.poly2tri.sweep.Triangulate(ctx);

  printTriangles(ctx.GetTriangles());

  test.done();
}
