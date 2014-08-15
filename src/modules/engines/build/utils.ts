
import buildstructs = require('./structs');
import MU = require('../../../libs/mathutils');
import GLM = require('../../../libs_js/glmatrix');
import triangulator = require('../../triangulator');
import mb = require('../../meshbuilder');
import DS = require('../../drawstruct');

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

  return function (x:number, y:number, rotation:number):number {
    GLM.vec2.set(vec, x, y);
    var dist = GLM.vec2.dot(normal, vec) + w;
    return -(rotation * UNITS2DEG) * dist * SCALE;
  };
}


var TYPE_SECTOR_FLOOR = 1;
var TYPE_SECTOR_CEILING = 2;
var TYPE_WALL = 3;
class ObjectHandle {
  constructor(public material:DS.Material, public offset:number, public len:number) {}
}

function len(x:number, y:number) {
  return Math.sqrt(x*x + y*y);
}

function addFace(builder:mb.MeshBuilder, type:number, verts:number[][], tcs:number[][], idx:number) {
  builder.start(type)
    .attr('aNorm', MU.normal(verts))
    .attr('aIdx', MU.int2vec4(idx));
  for (var i = 0; i < type; i++){
    builder
      .attr('aTc', tcs[i])
      .vtx('aPos', verts[i]);
  }
  builder.end();
}

function addWall(builder:mb.MeshBuilder, quad:number[][], idx:number, material:DS.Material):ObjectHandle {
  // a -> b
  // ^    |
  // |    v
  // d <- c
  var tcscalex = material.getTexture('base').getWidth() * 16;
  var tcscaley = material.getTexture('base').getHeight() * 16;
  var d = quad[3]; var dtc = [0, 0];
  var a = quad[0]; var atc = [0, (d[1]-a[1])/tcscaley];
  var b = quad[1]; var btc = [len(d[0]-b[0], d[2]-b[2])/tcscalex, (d[1]-b[1])/tcscaley];
  var c = quad[2]; var ctc = [len(d[0]-b[0], d[2]-b[2])/tcscalex, (d[1]-c[1])/tcscaley];
  var offset = builder.offset() * 2;

  if (a[1] == d[1]) {
    addFace(builder, mb.TRIANGLES, [a,b,c], [atc,btc,ctc], idx);
    return new ObjectHandle(material, offset, 3);
  }
  if (b[1] == c[1]) {
    addFace(builder, mb.TRIANGLES, [a,b,d], [atc,btc,dtc], idx);
    return new ObjectHandle(material, offset, 3);
  }
  if (a[1] < d[1] && b[1] < c[1]){
    addFace(builder, mb.QUADS, [d,c,b,a], [dtc,ctc,btc,atc], idx);
    return new ObjectHandle(material, offset, 6);
  }

  var tmp = GLM.vec3.create();
  var left = Math.abs(a[1] - d[1]);
  var right = Math.abs(b[1] - c[1]);
  var k = left < right ? (left/right)*0.5 : 1 - (right/left)*0.5;

  if (a[1] < d[1]) {
    GLM.vec3.sub(tmp, c, d);
    GLM.vec3.scale(tmp, tmp, k);
    var e = GLM.vec3.add(GLM.vec3.create(), d, tmp);
    var etc = [len(e[0], e[2])/tcscalex, e[1]/tcscaley];
    addFace(builder, mb.TRIANGLES, [d,e,a], [dtc,etc,atc], idx);
    addFace(builder, mb.TRIANGLES, [e,b,c], [etc,btc,ctc], idx);
    return new ObjectHandle(material, offset, 6);
  }
  if (b[1] < c[1]) {
    GLM.vec3.sub(tmp, b, a);
    GLM.vec3.scale(tmp, tmp, k);
    var e = GLM.vec3.add(GLM.vec3.create(), a, tmp);
    var etc = [len(e[0], e[2])/tcscalex, e[1]/tcscaley];
    addFace(builder, mb.TRIANGLES, [a,e,d], [atc,etc,dtc], idx);
    addFace(builder, mb.TRIANGLES, [e,c,b], [etc,ctc,btc], idx);
    return new ObjectHandle(material, offset, 6); 
  }
  addFace(builder, mb.QUADS, quad, [atc,btc,ctc,dtc], idx);
  return new ObjectHandle(material, offset, 6);
}

function addSector(ceiling:boolean, sector:buildstructs.Sector, walls:buildstructs.Wall[], heinum:number, z:number, slope:any, builder:mb.MeshBuilder, idx:number, material:DS.Material):ObjectHandle {
  var tcscalex = material.getTexture('base').getWidth() * 16;
  var tcscaley = material.getTexture('base').getHeight() * 16;
  var offset = builder.offset() * 2;
  var contour = getContours(sector, walls);
  var tris:number[][] = triangulator.triangulate(contour.getContour(), contour.getHoles());
  for (var i = 0; i < tris.length; i += 3) {
    var t0x = tris[i+0][0];
    var t1x = tris[i+1][0];
    var t2x = tris[i+2][0];
    var t0y = tris[i+0][1];
    var t1y = tris[i+1][1];
    var t2y = tris[i+2][1];
    var z1 = slope(t0x, t0y, heinum) + z;
    var z2 = slope(t1x, t1y, heinum) + z;
    var z3 = slope(t2x, t2y, heinum) + z;
    var v1 = [t0x, z1 / SCALE, t0y];
    var v2 = [t1x, z2 / SCALE, t1y];
    var v3 = [t2x, z3 / SCALE, t2y];
    var v1tc = [t0x/tcscalex, t0y/tcscaley];
    var v2tc = [t1x/tcscalex, t1y/tcscaley];
    var v3tc = [t2x/tcscalex, t2y/tcscaley];

    addFace(builder, mb.TRIANGLES, ceiling ? [v3,v2,v1] : [v1,v2,v3], ceiling ? [v3tc,v2tc,v1tc] : [v1tc,v2tc,v3tc], idx);
  }
  return new ObjectHandle(material, offset, tris.length);
}

export interface MaterialFactory {
  get(picnum:number):DS.Material;
}

class WallInfo {
  constructor(public normal:number[], public ds:DS.DrawStruct){}
}

class SectorInfo {
  constructor(public floor:DS.DrawStruct, public ceiling:DS.DrawStruct){}
}

export class BoardProcessor {
  private sectors:SectorInfo[] = [];
  private walls:WallInfo[] = [];

  constructor(private board:buildstructs.Board) {}

  public build(gl:WebGLRenderingContext, materialFactory:MaterialFactory):void {
    var objs:any = [];
    var builder = new mb.MeshBuilderConstructor()
      .buffer('aPos', Float32Array, gl.FLOAT, 3)
      .buffer('aNorm', Float32Array, gl.FLOAT, 3)
      .buffer('aIdx', Uint8Array, gl.UNSIGNED_BYTE, 4, true)
      .buffer('aTc', Float32Array, gl.FLOAT, 2)
      .index(Uint16Array, gl.UNSIGNED_SHORT)
      .build();

    var idx = 1;
    var sectors = this.board.sectors;
    var walls = this.board.walls;
    for (var s = 0; s < sectors.length; s++) {
      var sectorIdx = idx++;
      var sector = sectors[s];

      var slope = createSlopeCalculator(sector, walls);
      var ceilingheinum = sector.ceilingheinum;
      var ceilingz = sector.ceilingz;
      var floorheinum = sector.floorheinum;
      var floorz = sector.floorz;

      var i = 0;
      while (i < sector.wallnum) {
        var w = sector.wallptr + i;
        var wall = walls[w];
        var wall2 = walls[wall.point2];
        var x1 = wall.x;
        var y1 = wall.y;
        var x2 = wall2.x;
        var y2 = wall2.y;
        var material = materialFactory.get(wall.picnum);

        if (wall.nextwall == -1) {
          var z1 = slope(x1, y1, ceilingheinum) + ceilingz;
          var z2 = slope(x2, y2, ceilingheinum) + ceilingz;
          var z3 = slope(x2, y2, floorheinum) + floorz;
          var z4 = slope(x1, y1, floorheinum) + floorz;

          var a = [x1, z1 / SCALE, y1];
          var b = [x2, z2 / SCALE, y2];
          var c = [x2, z3 / SCALE, y2];
          var d = [x1, z4 / SCALE, y1];
          objs.push([addWall(builder, [a, b, c, d], idx, material), TYPE_WALL, w]);
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
            objs.push([addWall(builder, [a, b, c, d], idx, material), TYPE_WALL, w]);
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
            objs.push([addWall(builder, [a, b, c, d], idx, material), TYPE_WALL, w]);
          }
        }
        i++;
        idx++;
      }

      objs.push([addSector(false, sector, walls, floorheinum, floorz, slope, builder, sectorIdx, materialFactory.get(sector.floorpicnum)), TYPE_SECTOR_FLOOR, s]);
      objs.push([addSector(true, sector, walls, ceilingheinum, ceilingz, slope, builder, sectorIdx, materialFactory.get(sector.ceilingpicnum)), TYPE_SECTOR_CEILING, s]);
    }

    var tmp:mb.Mesh = <mb.Mesh>builder.build(gl, null);
    var vtxBuf = tmp.getVertexBuffers();
    var idxBuf = tmp.getIndexBuffer();
    var mode = tmp.getMode();
    for (var i = 0; i < objs.length; i++) {
      var obj = objs[i][0];
      var type = objs[i][1];
      var id = objs[i][2];

      if (type == TYPE_WALL && id == objs[i+1][2]) {
        var wall1 = walls[id];
        var wall2 = walls[wall1.point2];
        var normal = MU.normal2d([wall1.x, wall1.y], [wall2.x, wall2.y]);
        var wallMesh = new mb.Mesh(obj.material, vtxBuf, idxBuf, mode, obj.len + objs[i+1][0].len, obj.offset);
        this.walls[id] = new WallInfo(normal, wallMesh);
        i++;
      } else {
        var wall1 = walls[id];
        var wall2 = walls[wall1.point2];
        var normal = MU.normal2d([wall1.x, wall1.y], [wall2.x, wall2.y]);
        var wallMesh = new mb.Mesh(obj.material, vtxBuf, idxBuf, mode, obj.len, obj.offset)
        this.walls[id] = new WallInfo(normal, wallMesh);
      }

      if (type == TYPE_SECTOR_FLOOR) {
        var floor = new mb.Mesh(obj.material, vtxBuf, idxBuf, mode, obj.len, obj.offset);
        var ceiling = new mb.Mesh(objs[i+1][0].material, vtxBuf, idxBuf, mode, objs[i+1][0].len, objs[i+1][0].offset);
        this.sectors[id] = new SectorInfo(floor, ceiling);
        i++;
      }
    }
  }

  public get(pos:number[], eye:number[]):DS.DrawStruct[] {
    var ds:DS.DrawStruct[] = [];
    var sectors = this.sectors;
    var walls = this.walls;
    for (var i = 0; i < sectors.length; i++) {
      ds.push(sectors[i].floor);
      ds.push(sectors[i].ceiling);
    }
    var eye2d = [eye[0], eye[2]];
    GLM.vec2.normalize(eye2d, eye2d);
    for (var i = 0; i < walls.length; i++) {
      var wall = walls[i];
      if (wall == undefined)
        continue;
      if (GLM.vec2.dot(eye2d, wall.normal) <= 0)
        ds.push(wall.ds);
    }
    return ds;
  }
}

// export class MoveStruct {

//   public x:number;
//   public y:number;
//   public z:number;
//   public sec:number;
// }

// export function(board:buildstructs.Board, ms:MoveStruct, dx:number, dy:number, dz:number):void {
//   if (dx == 0 && dy == 0 && dz == 0)
//     return;

//     var walls = board.walls;
//     var cursec = getSector(board, ms);
//     var nx = ms.x + dx;
//     var ny = ms.y + dy;
//     var nz = ms.z + dz;

//     var slope = createSlopeCalculator(sector, walls);
//     var ceilingheinum = sector.ceilingheinum;
//     var ceilingz = sector.ceilingz;
//     var floorheinum = sector.floorheinum;
//     var floorz = sector.floorz;

//     for (var w = 0; w < cursec.wallnum; w++) {
//       var wallidx = cursec.wallptr + w;
//       var wall = walls[wallidx];
//       var wall2 = walls[wall.point2];
//       var x1 = wall.x;
//       var y1 = wall.y;
//       var x2 = wall2.x;
//       var y2 = wall2.y;
//       var cz1 = slope(x1, y1, ceilingheinum) + ceilingz;
//       var fz1 = slope(x1, y1, floorheinum) + floorz;
//       var cz2 = slope(x2, y2, ceilingheinum) + ceilingz;
//       var fz2 = slope(x2, y2, floorheinum) + floorz;

//       var inter = MU.line2dIntersect(x1,y1,x2,y2,ms.x,ms.y,nx,ny);
//       if (inter == null)
//         continue;

//       var interf = slope(inter.x, inter.y, floorheinum) + floorz;
//       var interc = slope(inter.x, inter.y, ceilingheinum) + ceilingz;

      

//     }
// }

// function getSector(board:buildstructs.Board, ms:MoveStruct):buildstructs.Sector {
//   return board.sectors[ms.sec];
// }