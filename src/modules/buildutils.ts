/// <reference path="../defs/webgl.d.ts"/>

import buildstructs = require('../libs/buildstructs');
import MU = require('../libs/mathutils');
import GLM = require('../libs_js/glmatrix');
import data = require('../libs/dataviewstream');
import getter = require('../libs/getter');
import triangulator = require('./triangulator');
import mb = require('./meshbuilder');
import build = require('./buildloader');

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

function createSlopeCalculator(sector:buildstructs.Sector, walls:buildstructs.Wall[], scale:number) {
  var wall1 = walls[sector.wallptr];
  var wall2 = walls[wall1.point2];

  var normal = GLM.vec2.fromValues(-(wall2.y - wall1.y), wall2.x - wall1.x);
  GLM.vec2.normalize(normal, normal);
  var w = -GLM.vec2.dot(normal, GLM.vec2.fromValues(wall1.x , wall1.y));

  var dh  = function(x:number, y:number, rotation:number):number {
    var dist = GLM.vec2.dot(normal, GLM.vec2.fromValues(x , y)) + w;
    return -Math.tan(MU.deg2rad(rotation * (45/4096))) * dist * scale;
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

    var i = 0;
    var scale = -16;
    var slope = createSlopeCalculator(sector, walls, scale);
    while (i < sector.wallnum) {
      var wall = walls[sector.wallptr + i];
      var wall2 = walls[wall.point2];

      if (wall.nextwall == -1) {
        var z1 = slope(wall.x, wall.y, sector.ceilingheinum) + sector.ceilingz;
        var z2 = slope(wall2.x, wall2.y, sector.ceilingheinum) + sector.ceilingz;
        var z3 = slope(wall2.x, wall2.y, sector.floorheinum) + sector.floorz;
        var z4 = slope(wall.x, wall.y, sector.floorheinum) + sector.floorz;

        var a = [wall.x, z1 / scale, wall.y];
        var b = [wall2.x, z2 / scale, wall2.y];
        var c = [wall2.x, z3 / scale, wall2.y];
        var d = [wall.x, z4 / scale, wall.y];
        builder.addQuad([a, b, c, d]);
      } else {
        var nextsector = sectors[wall.nextsector];
        var nextslope = createSlopeCalculator(nextsector, walls, scale);

        if (sector.floorz > nextsector.floorz){
          var z1 = slope(wall.x, wall.y, sector.floorheinum) + sector.floorz;
          var z2 = slope(wall2.x, wall2.y, sector.floorheinum) + sector.floorz;
          var z3 = nextslope(wall2.x, wall2.y, nextsector.floorheinum) + nextsector.floorz;
          var z4 = nextslope(wall.x, wall.y, nextsector.floorheinum) + nextsector.floorz;

          var a = [wall.x, z1 / scale, wall.y];
          var b = [wall2.x, z2 / scale, wall2.y];
          var c = [wall2.x, z3 / scale, wall2.y];
          var d = [wall.x, z4 / scale, wall.y];
          builder.addQuad([d, c, b, a]);
          builder.addQuad([a, b, c, d]);
        }

        if (sector.ceilingz < nextsector.ceilingz){
          var z1 = slope(wall.x, wall.y, sector.ceilingheinum) + sector.ceilingz;
          var z2 = slope(wall2.x, wall2.y, sector.ceilingheinum) + sector.ceilingz;
          var z3 = nextslope(wall2.x, wall2.y, nextsector.ceilingheinum) + nextsector.ceilingz;
          var z4 = nextslope(wall.x, wall.y, nextsector.ceilingheinum) + nextsector.ceilingz;

          var a = [wall.x, z1 / scale, wall.y];
          var b = [wall2.x, z2 / scale, wall2.y];
          var c = [wall2.x, z3 / scale, wall2.y];
          var d = [wall.x, z4 / scale, wall.y];
          builder.addQuad([d, c, b, a]);
          builder.addQuad([a, b, c, d]);
        }
      }
      i++;
    }

    for (var i = 0; i < tris.length; i += 3) {
      var z1 = slope(tris[i + 0][0], tris[i + 0][1], sector.floorheinum) + sector.floorz;
      var z2 = slope(tris[i + 1][0], tris[i + 1][1], sector.floorheinum) + sector.floorz;
      var z3 = slope(tris[i + 2][0], tris[i + 2][1], sector.floorheinum) + sector.floorz;

      builder.addTriangle([
        [tris[i + 0][0], z1 / scale, tris[i + 0][1]],
        [tris[i + 1][0], z2 / scale, tris[i + 1][1]],
        [tris[i + 2][0], z3 / scale, tris[i + 2][1]]
      ]);

      var z1 = slope(tris[i + 2][0], tris[i + 2][1], sector.ceilingheinum) + sector.ceilingz;
      var z2 = slope(tris[i + 1][0], tris[i + 1][1], sector.ceilingheinum) + sector.ceilingz;
      var z3 = slope(tris[i + 0][0], tris[i + 0][1], sector.ceilingheinum) + sector.ceilingz;

      builder.addTriangle([
        [tris[i + 2][0], z1 / scale, tris[i + 2][1]],
        [tris[i + 1][0], z2 / scale, tris[i + 1][1]],
        [tris[i + 0][0], z3 / scale, tris[i + 0][1]]
      ]);
    }
  }

  return builder.build(gl);
}