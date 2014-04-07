/// <reference path="../defs/webgl.d.ts"/>

import buildstructs = require('../libs/buildstructs');
import MU = require('../libs/mathutils');
import GLM = require('../libs_js/glmatrix');
import triangulator = require('./triangulator');
import mb = require('./meshbuilder');

var SCALE = -16;
var UNITS2DEG = (1 / 4096);

interface TriangulatedSector {
  getContour():number[][];
  getHoles():number[][][]
}

class TriangulationContext implements TriangulatedSector {
  private contour:number[][];
  private holes = [];

  public addContour(contour:number[][]) {
    if (!this.contour && !MU.isCW(contour)) {
      this.contour = contour;
    } else {
      this.holes.push(contour);
    }
  }

  public getContour():number[][] {
    return this.contour;
  }

  public getHoles():number[][][] {
    return this.holes;
  }
}

function getContours(sector:buildstructs.Sector, walls:buildstructs.Wall[]):TriangulatedSector {
  var i = 0;
  var pairs = [];
  while (i < sector.wallnum) {
    var firstwallIdx = i + sector.wallptr;
    var wall = walls[sector.wallptr + i];
    while (wall.point2 != firstwallIdx){
      wall = walls[wall.point2];
      i++;
    }
    i++;
    pairs.push([firstwallIdx, sector.wallptr+i]);
  }

  var ctx = new TriangulationContext();
  for (var i = 0; i < pairs.length; i++) {
    var contour = [];
    var pair = pairs[i];
    for (var j = pair[0]; j < pair[1]; j++) {
      contour.push([walls[j].x, walls[j].y]);
    }
    ctx.addContour(contour);
  }
  return ctx;
}

function createSlopeCalculator(sector:buildstructs.Sector, walls:buildstructs.Wall[]) {
  var wall1 = walls[sector.wallptr];
  var wall2 = walls[wall1.point2];

  var normal = GLM.vec2.fromValues(-(wall2.y - wall1.y), wall2.x - wall1.x);
  GLM.vec2.normalize(normal, normal);
  var w = -GLM.vec2.dot(normal, GLM.vec2.fromValues(wall1.x , wall1.y));
  var vec = GLM.vec2.create();

  var dh  = function(x:number, y:number, rotation:number):number {
    GLM.vec2.set(vec, x ,y);
    var dist = GLM.vec2.dot(normal, vec) + w;
    return -(rotation * UNITS2DEG) * dist * SCALE;
  }
  return dh;
}

function addWall(builder:mb.MeshBuilder, quad:number[][]) {
  // a -> b
  // ^    |
  // |    v
  // d <- c
  var a = quad[0];
  var b = quad[1];
  var c = quad[2];
  var d = quad[3];

  if (a[1] == d[1]) {
    builder.addTriangle([a,b,c]);
    return;
  }
  if (b[1] == c[1]) {
    builder.addTriangle([a,b,d]);
    return;
  }
  if (a[1] < d[1] && b[1] < c[1]){
    builder.addQuad([d, c , b , a]);
    return;
  }

  var tmp = GLM.vec3.create();
  var left = Math.abs(a[1] - d[1]);
  var right = Math.abs(b[1] - c[1]);
  var k = left < right ? (left/right)*0.5 : 1 - (right/left)*0.5

  if (a[1] < d[1]) {
    GLM.vec3.sub(tmp, c, d);
    GLM.vec3.scale(tmp, tmp, k);
    var e = GLM.vec3.add(GLM.vec3.create(), d, tmp);
    builder.addTriangle([d, e, a]);
    builder.addTriangle([e, b, c]);
    return;
  }
  if (b[1] < c[1]) {
    GLM.vec3.sub(tmp, b, a);
    GLM.vec3.scale(tmp, tmp, k);
    var e = GLM.vec3.add(GLM.vec3.create(), a, tmp);
    builder.addTriangle([a, e, d]);
    builder.addTriangle([e, c, b]);
    return; 
  }
  builder.addQuad(quad);
}

export function buildBoard(board:buildstructs.Board, gl:WebGLRenderingContext):mb.DrawData {
  var walls = board.walls;
  var sectors = board.sectors;

  var builder = new mb.MeshBuilder();
  for (var s = 0; s < sectors.length; s++) {
    var sector = sectors[s];
    var contour = getContours(sector, walls);
    var tris:number[][] = null;
    try {
      tris = triangulator.triangulate(contour.getContour(), contour.getHoles());
    } catch (e) {
      console.log(e);
    }
    if (tris == null){
      console.log(sector);
      continue;
    }

    var slope = createSlopeCalculator(sector, walls);
    var ceilingheinum = sector.ceilingheinum;
    var ceilingz = sector.ceilingz;
    var floorheinum = sector.floorheinum;
    var floorz = sector.floorz;

    var i = 0;
    while (i < sector.wallnum) {
      var wall = walls[sector.wallptr + i];
      var wall2 = walls[wall.point2];
      var x1 = wall.x;
      var y1 = wall.y;
      var x2 = wall2.x;
      var y2 = wall2.y;

      if (wall.nextwall == -1) {
        var z1 = slope(x1, y1, ceilingheinum) + ceilingz;
        var z2 = slope(x2, y2, ceilingheinum) + ceilingz;
        var z3 = slope(x2, y2, floorheinum) + floorz;
        var z4 = slope(x1, y1, floorheinum) + floorz;

        var a = [x1, z1 / SCALE, y1];
        var b = [x2, z2 / SCALE, y2];
        var c = [x2, z3 / SCALE, y2];
        var d = [x1, z4 / SCALE, y1];
        addWall(builder, [a, b, c, d]);
      } else {
        var nextsector = sectors[wall.nextsector];
        var nextslope = createSlopeCalculator(nextsector, walls);
        var nextfloorz = nextsector.floorz;
        var nextceilingz = nextsector.ceilingz;

        var nextfloorheinum = nextsector.floorheinum;
        var z1 = nextslope(x1, y1, nextfloorheinum) + nextfloorz;
        var z2 = nextslope(x2, y2, nextfloorheinum) + nextfloorz;
        var z3 = slope(x2, y2, floorheinum) + floorz;
        var z4 = slope(x1, y1, floorheinum) + floorz;
        if (z4 > z1 || z3 > z2){
          var a = [x1, z1 / SCALE, y1];
          var b = [x2, z2 / SCALE, y2];
          var c = [x2, z3 / SCALE, y2];
          var d = [x1, z4 / SCALE, y1];
          addWall(builder, [a, b, c, d]);
        }

        var nextceilingheinum = nextsector.ceilingheinum;
        var z1 = slope(x1, y1, ceilingheinum) + ceilingz;
        var z2 = slope(x2, y2, ceilingheinum) + ceilingz;
        var z3 = nextslope(x2, y2, nextceilingheinum) + nextceilingz;
        var z4 = nextslope(x1, y1, nextceilingheinum) + nextceilingz;
        if (z1 < z4 || z2 < z3){
          var a = [x1, z1 / SCALE, y1];
          var b = [x2, z2 / SCALE, y2];
          var c = [x2, z3 / SCALE, y2];
          var d = [x1, z4 / SCALE, y1];
          addWall(builder, [a, b, c, d]);
        }
      }
      i++;
    }

    for (var i = 0; i < tris.length; i += 3) {
      var t0x = tris[i+0][0];
      var t1x = tris[i+1][0];
      var t2x = tris[i+2][0];
      var t0y = tris[i+0][1];
      var t1y = tris[i+1][1];
      var t2y = tris[i+2][1];

      var z1 = slope(t0x, t0y, floorheinum) + floorz;
      var z2 = slope(t1x, t1y, floorheinum) + floorz;
      var z3 = slope(t2x, t2y, floorheinum) + floorz;

      builder.addTriangle([
        [t0x, z1 / SCALE, t0y],
        [t1x, z2 / SCALE, t1y],
        [t2x, z3 / SCALE, t2y]
      ]);

      var z1 = slope(t2x, t2y, ceilingheinum) + ceilingz;
      var z2 = slope(t1x, t1y, ceilingheinum) + ceilingz;
      var z3 = slope(t0x, t0y, ceilingheinum) + ceilingz;

      builder.addTriangle([
        [t2x, z1 / SCALE, t2y],
        [t1x, z2 / SCALE, t1y],
        [t0x, z3 / SCALE, t0y]
      ]);
    }
  }

  return builder.build(gl);
}