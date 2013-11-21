/// <reference path="../defs/webgl.d.ts"/>

import buildstructs = require('../libs/buildstructs');
import MU = require('../libs/mathutils');
import GLM = require('../libs_js/glmatrix');
import data = require('../libs/dataviewstream');
import getter = require('../libs/getter');
import triangulator = require('./triangulator');
import mb = require('./meshbuilder');
import build = require('./buildloader');

var SCALE = -16;
var UNITS2DEG = (1 / 4096);

interface TriangulatedSector {
  getContour():number[][];
  getHoles():number[][][]
}

class TriangulationContext implements TriangulatedSector{
  private contour:number[][];
  private holes = [];

  public addContour(contour:number[][]) {
    if (!MU.isCW(contour)) {
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

export function buildBoard(fname:string, gl:WebGLRenderingContext):mb.DrawData {
  var board = build.loadBuildMap(new data.DataViewStream(getter.get(fname), true));
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
        builder.addQuad([a, b, c, d]);
      } else {
        var nextsector = sectors[wall.nextsector];
        var nextslope = createSlopeCalculator(nextsector, walls);
        var nextfloorz = nextsector.floorz;
        var nextceilingz = nextsector.ceilingz;

        if (floorz > nextfloorz){
          var nextfloorheinum = nextsector.floorheinum;
          var z1 = slope(x1, y1, floorheinum) + floorz;
          var z2 = slope(x2, y2, floorheinum) + floorz;
          var z3 = nextslope(x2, y2, nextfloorheinum) + nextfloorz;
          var z4 = nextslope(x1, y1, nextfloorheinum) + nextfloorz;

          var a = [x1, z1 / SCALE, y1];
          var b = [x2, z2 / SCALE, y2];
          var c = [x2, z3 / SCALE, y2];
          var d = [x1, z4 / SCALE, y1];
          builder.addQuad([d, c, b, a]);
          builder.addQuad([a, b, c, d]);
        }

        if (ceilingz < nextceilingz){
          var nextceilingheinum = nextsector.ceilingheinum;
          var z1 = slope(x1, y1, ceilingheinum) + ceilingz;
          var z2 = slope(x2, y2, ceilingheinum) + ceilingz;
          var z3 = nextslope(x2, y2, nextceilingheinum) + nextceilingz;
          var z4 = nextslope(x1, y1, nextceilingheinum) + nextceilingz;

          var a = [x1, z1 / SCALE, y1];
          var b = [x2, z2 / SCALE, y2];
          var c = [x2, z3 / SCALE, y2];
          var d = [x1, z4 / SCALE, y1];
          builder.addQuad([d, c, b, a]);
          builder.addQuad([a, b, c, d]);
        }
      }
      i++;
    }

    for (var i = 0; i < tris.length; i += 3) {
      var z1 = slope(tris[i + 0][0], tris[i + 0][1], floorheinum) + floorz;
      var z2 = slope(tris[i + 1][0], tris[i + 1][1], floorheinum) + floorz;
      var z3 = slope(tris[i + 2][0], tris[i + 2][1], floorheinum) + floorz;

      builder.addTriangle([
        [tris[i + 0][0], z1 / SCALE, tris[i + 0][1]],
        [tris[i + 1][0], z2 / SCALE, tris[i + 1][1]],
        [tris[i + 2][0], z3 / SCALE, tris[i + 2][1]]
      ]);

      var z1 = slope(tris[i + 2][0], tris[i + 2][1], ceilingheinum) + ceilingz;
      var z2 = slope(tris[i + 1][0], tris[i + 1][1], ceilingheinum) + ceilingz;
      var z3 = slope(tris[i + 0][0], tris[i + 0][1], ceilingheinum) + ceilingz;

      builder.addTriangle([
        [tris[i + 2][0], z1 / SCALE, tris[i + 2][1]],
        [tris[i + 1][0], z2 / SCALE, tris[i + 1][1]],
        [tris[i + 0][0], z3 / SCALE, tris[i + 0][1]]
      ]);
    }
  }

  return builder.build(gl);
}