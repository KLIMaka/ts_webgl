
import buildstructs = require('./structs');
import MU = require('../../../libs/mathutils');
import GLM = require('../../../libs_js/glmatrix');
import triangulator = require('../../triangulator');
import mb = require('../../meshbuilder');
import DS = require('../../drawstruct');

var SCALE = -16;
var TCBASE = 8192;
var UNITS2DEG = (1 / 4096);

interface TriangulatedSector {
  getContour():number[][];
  getHoles():number[][][];
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

  public fix():void {
    if (this.contour == undefined) {
      this.contour = this.holes[0];
      this.holes = [];
    }
  }

  public getContour():number[][] {
    return this.contour;
  }

  public getHoles():number[][][] {
    return this.holes;
  }

  public removeHoles():void {
    this.holes = [];
  }

  public remove(p:any) {
    var contour = this.contour;
    for (var i = 0; i < contour.length; i++) {
      var cp = contour[i];
      if (p.x == cp[0] && p.y == cp[1]) {
        contour.splice(i, 1);
        break;
      }
    }
  }
}

function triangulate(sector:buildstructs.Sector, walls:buildstructs.Wall[]):number[][] {
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
  ctx.fix();

  var res:number[][] = null;
  while (res == null) {
    var size = ctx.getContour().length;
    try {
      res = triangulator.triangulate(ctx.getContour(), ctx.getHoles());
    } catch (e) {
      ctx.remove(e.points[0]);
      if (size == ctx.getContour().length)
        ctx.removeHoles();
    }
  }
  return res;
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
  constructor(public material:DS.Material, public normal:number[], public offset:number, public len:number) {}
}

function len(x:number, y:number) {
  return Math.sqrt(x*x + y*y);
}

function addFace(builder:mb.MeshBuilder, type:number, verts:number[][], tcs:number[][], idx:number, shade:number) {
  builder.start(type)
    .attr('aNorm', MU.normal(verts))
    .attr('aIdx', MU.int2vec4(idx))
    .attr('aShade', [shade]);
  for (var i = 0; i < type; i++){
    builder
      .attr('aTc', tcs[i])
      .vtx('aPos', verts[i]);
  }
  builder.end();
}

function addWall(wall:buildstructs.Wall, builder:mb.MeshBuilder, quad:number[][], idx:number, material:DS.Material, base:number):ObjectHandle {
  // a -> b
  // ^    |
  // |    v
  // d <- c
  var xflip = ((wall.cstat & 8) != 0) ? -1 : 1;
  var yflip = ((wall.cstat & 256) != 0) ? -1 : 1;
  var tcscalex = wall.xrepeat / 8.0 / (material.getTexture('base').getWidth() / 64.0) * xflip;
  var tcscaley = (material.getTexture('base').getHeight() * 16) / (wall.yrepeat / 8.0) * yflip;
  var shade = wall.shade;
  var tcxoff = wall.xpanning / material.getTexture('base').getWidth();
  var tcyoff = wall.ypanning * wall.yrepeat;

  var a = quad[0]; var atc = [tcxoff,          (tcyoff+base-a[1])/tcscaley];
  var b = quad[1]; var btc = [tcxoff+tcscalex, (tcyoff+base-b[1])/tcscaley];
  var c = quad[2]; var ctc = [tcxoff+tcscalex, (tcyoff+base-c[1])/tcscaley];
  var d = quad[3]; var dtc = [tcxoff,          (tcyoff+base-d[1])/tcscaley];
  var offset = builder.offset() * 2;

  if (a[1] == d[1]) {
    addFace(builder, mb.TRIANGLES, [a,b,c], [atc,btc,ctc], idx, shade);
    return new ObjectHandle(material, MU.normal([a,b,c]), offset, 3);
  }
  if (b[1] == c[1]) {
    addFace(builder, mb.TRIANGLES, [a,b,d], [atc,btc,dtc], idx, shade);
    return new ObjectHandle(material, MU.normal([a,b,d]), offset, 3);
  }
  if (a[1] < d[1] && b[1] < c[1]){
    addFace(builder, mb.QUADS, [d,c,b,a], [dtc,ctc,btc,atc], idx, shade);
    return new ObjectHandle(material, MU.normal([d,c,b,a]), offset, 6);
  }

  if (a[1] < d[1]) {
    var e = MU.intersect3d(a,b,c,d);
    var etc = [len(e[0], e[2])/tcscalex, (base-e[1])/tcscaley];
    addFace(builder, mb.TRIANGLES, [d,e,a], [dtc,etc,atc], idx, shade);
    addFace(builder, mb.TRIANGLES, [e,b,c], [etc,btc,ctc], idx, shade);
    return new ObjectHandle(material, MU.normal([d,e,a]), offset, 6);
  }
  if (b[1] < c[1]) {
    var e = MU.intersect3d(a,b,c,d);
    var etc = [len(e[0], e[2])/tcscalex, (base-e[1])/tcscaley];
    addFace(builder, mb.TRIANGLES, [a,e,d], [atc,etc,dtc], idx, shade);
    addFace(builder, mb.TRIANGLES, [e,c,b], [etc,ctc,btc], idx, shade);
    return new ObjectHandle(material, MU.normal([a,e,d]), offset, 6);
  }
  addFace(builder, mb.QUADS, quad, [atc,btc,ctc,dtc], idx, shade);
  return new ObjectHandle(material, MU.normal([a,b,c]), offset, 6);
}

function addSector(tris:number[][], ceiling:boolean, sector:buildstructs.Sector, walls:buildstructs.Wall[], heinum:number, z:number, slope:any, builder:mb.MeshBuilder, idx:number, material:DS.Material):ObjectHandle {
  var tcscalex = material.getTexture('base').getWidth() * 16;
  var tcscaley = material.getTexture('base').getHeight() * 16;
  var offset = builder.offset() * 2;
  var normal:number[] = null;
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

    addFace(builder, mb.TRIANGLES, ceiling ? [v3,v2,v1] : [v1,v2,v3], ceiling ? [v3tc,v2tc,v1tc] : [v1tc,v2tc,v3tc], idx, ceiling ? sector.ceilingshade : sector.floorshade);
    if (normal == null) normal = MU.normal(ceiling ? [v3,v2,v1] : [v1,v2,v3]);
  }
  return new ObjectHandle(material, normal, offset, tris.length);
}

export interface MaterialFactory {
  get(picnum:number):DS.Material;
}

class WallInfo {
  constructor(public normal:number[], public ds:DS.DrawStruct){}
}

class SectorInfo {
  constructor(public floorNormal:number[], public ceilingNormal:number[], public floor:DS.DrawStruct, public ceiling:DS.DrawStruct){}
}

export class BoardProcessor {
  private walls:WallInfo[] = [];
  private sectors:SectorInfo[] = [];
  private index:any = [];

  constructor(private board:buildstructs.Board) {}

  public build(gl:WebGLRenderingContext, materialFactory:MaterialFactory):void {
    var objs:any = [];
    var builder = new mb.MeshBuilderConstructor()
      .buffer('aPos', Float32Array, gl.FLOAT, 3)
      .buffer('aNorm', Float32Array, gl.FLOAT, 3)
      .buffer('aIdx', Uint8Array, gl.UNSIGNED_BYTE, 4, true)
      .buffer('aTc', Float32Array, gl.FLOAT, 2)
      .buffer('aShade', Int8Array, gl.BYTE, 1)
      .index(Uint16Array, gl.UNSIGNED_SHORT)
      .build();

    var idx = 1;
    var sectors = this.board.sectors;
    var walls = this.board.walls;
    for (var s = 0; s < sectors.length; s++) {
      var sectorIdx = idx++;
      var sector = sectors[s];
      this.index[sectorIdx] = sector;

      var slope = createSlopeCalculator(sector, walls);
      var ceilingheinum = sector.ceilingheinum;
      var ceilingz = sector.ceilingz;
      var floorheinum = sector.floorheinum;
      var floorz = sector.floorz;

      var i = 0;
      while (i < sector.wallnum) {
        var w = sector.wallptr + i;
        var wall = walls[w];
        this.index[idx] = wall;
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
          var base = ((wall.cstat & 4) != 0) ? floorz : ceilingz;
          var wallobj = addWall(wall, builder, [a, b, c, d], idx, material, base / SCALE);
          objs.push([wallobj, TYPE_WALL, w]);
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
            var shade = wall.shade;
            var wall_ = ((wall.cstat & 2) != 0) ? walls[wall.nextwall] : wall;
            var base = ((wall.cstat & 4) != 0) ? ceilingz : nextfloorz;
            var wallobj = addWall(wall_, builder, [a, b, c, d], idx, materialFactory.get(wall_.picnum), base / SCALE)
            objs.push([wallobj, TYPE_WALL, w]);
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
            var base = ((wall.cstat & 4) != 0) ? ceilingz : nextceilingz;
            var wallobj = addWall(wall, builder, [a, b, c, d], idx, material, base / SCALE);
            objs.push([wallobj, TYPE_WALL, w]);
          }
        }
        i++;
        idx++;
      }

      var tris:number[][] = triangulate(sector, walls);
      var floorObj = addSector(tris, false, sector, walls, floorheinum, floorz, slope, builder, sectorIdx, materialFactory.get(sector.floorpicnum));
      objs.push([floorObj, TYPE_SECTOR_FLOOR, s]);
      var ceilingObj = addSector(tris, true, sector, walls, ceilingheinum, ceilingz, slope, builder, sectorIdx, materialFactory.get(sector.ceilingpicnum));
      objs.push([ceilingObj, TYPE_SECTOR_CEILING, s]);
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
        var wallMesh = new mb.Mesh(obj.material, vtxBuf, idxBuf, mode, obj.len + objs[i+1][0].len, obj.offset);
        this.walls[id] = new WallInfo(obj.normal, wallMesh);
        i++;
      } else if (type == TYPE_WALL) {
        var wallMesh = new mb.Mesh(obj.material, vtxBuf, idxBuf, mode, obj.len, obj.offset)
        this.walls[id] = new WallInfo(obj.normal, wallMesh);
      }

      if (type == TYPE_SECTOR_FLOOR) {
        var floor = new mb.Mesh(obj.material, vtxBuf, idxBuf, mode, obj.len, obj.offset);
        var ceiling = new mb.Mesh(objs[i+1][0].material, vtxBuf, idxBuf, mode, objs[i+1][0].len, objs[i+1][0].offset);
        this.sectors[id] = new SectorInfo(obj.normal, objs[i+1][0].normal, floor, ceiling);
        i++;
      }
    }
  }

  public get(pos:number[], eye:number[]):DS.DrawStruct[] {
    var ds:DS.DrawStruct[] = [];
    var sectors = this.sectors;
    var walls = this.walls;
    var fov = 0.707;
    for (var i = 0; i < sectors.length; i++) {
        var sector = sectors[i];
        if (sector == undefined)
          continue;
        if (GLM.vec3.dot(eye, sector.floorNormal) <= fov)
          ds.push(sector.floor);
        if (GLM.vec3.dot(eye, sector.ceilingNormal) <= fov)
          ds.push(sector.ceiling);
    }
    for (var i = 0; i < walls.length; i++) {
      var wall = walls[i];
      if (wall == undefined)
        continue;
      if (GLM.vec2.dot(eye, wall.normal) <= fov)
      ds.push(wall.ds);
    }
    return ds;
  }

  public getByIdx(idx:number):any {
    return this.index[idx];
  }
}

export class MoveStruct {

  public x:number;
  public y:number;
  public z:number;
  public sec:number;
}

export function move(board:buildstructs.Board, ms:MoveStruct, dx:number, dy:number, dz:number):void {
  if (dx == 0 && dy == 0 && dz == 0)
    return;

    var walls = board.walls;
    var cursec = getSector(board, ms);
    var nx = ms.x + dx;
    var ny = ms.y + dy;
    var nz = ms.z + dz;

    var slope = createSlopeCalculator(sector, walls);
    var ceilingheinum = sector.ceilingheinum;
    var ceilingz = sector.ceilingz;
    var floorheinum = sector.floorheinum;
    var floorz = sector.floorz;

    for (var w = 0; w < cursec.wallnum; w++) {
      var wallidx = cursec.wallptr + w;
      var wall = walls[wallidx];
      var wall2 = walls[wall.point2];
      var x1 = wall.x;
      var y1 = wall.y;
      var x2 = wall2.x;
      var y2 = wall2.y;
      var cz1 = slope(x1, y1, ceilingheinum) + ceilingz;
      var fz1 = slope(x1, y1, floorheinum) + floorz;
      var cz2 = slope(x2, y2, ceilingheinum) + ceilingz;
      var fz2 = slope(x2, y2, floorheinum) + floorz;

      var inter = MU.intersect2d([x1,y1],[x2,y2],[ms.x,ms.y],[nx,ny]);
      if (inter == null)
        continue;

      var interf = slope(inter[0], inter[1], floorheinum) + floorz;
      var interc = slope(inter[0], inter[1], ceilingheinum) + ceilingz;
    }
}

function getSector(board:buildstructs.Board, ms:MoveStruct):buildstructs.Sector {
  return board.sectors[ms.sec];
}