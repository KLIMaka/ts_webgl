
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

function addWall(wall:buildstructs.Wall, builder:BoardBuilder, quad:number[][], idx:number, material:DS.Material, base:number):ObjectHandle {
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
  var offset = builder.getOffset();

  if (a[1] == d[1]) {
    builder.addFace(mb.TRIANGLES, [a,b,c], [atc,btc,ctc], idx, shade);
    return new ObjectHandle(material, MU.normal([a,b,c]), offset, 3);
  }
  if (b[1] == c[1]) {
    builder.addFace(mb.TRIANGLES, [a,b,d], [atc,btc,dtc], idx, shade);
    return new ObjectHandle(material, MU.normal([a,b,d]), offset, 3);
  }
  if (a[1] < d[1] && b[1] < c[1]){
    builder.addFace(mb.QUADS, [d,c,b,a], [dtc,ctc,btc,atc], idx, shade);
    return new ObjectHandle(material, MU.normal([d,c,b,a]), offset, 6);
  }

  if (a[1] < d[1]) {
    var e = MU.intersect3d(a,b,c,d);
    var etc = [len(e[0], e[2])/tcscalex, (base-e[1])/tcscaley];
    builder.addFace(mb.TRIANGLES, [d,e,a], [dtc,etc,atc], idx, shade);
    builder.addFace(mb.TRIANGLES, [e,b,c], [etc,btc,ctc], idx, shade);
    return new ObjectHandle(material, MU.normal([d,e,a]), offset, 6);
  }
  if (b[1] < c[1]) {
    var e = MU.intersect3d(a,b,c,d);
    var etc = [len(e[0], e[2])/tcscalex, (base-e[1])/tcscaley];
    builder.addFace(mb.TRIANGLES, [a,e,d], [atc,etc,dtc], idx, shade);
    builder.addFace(mb.TRIANGLES, [e,c,b], [etc,ctc,btc], idx, shade);
    return new ObjectHandle(material, MU.normal([a,e,d]), offset, 6);
  }

  builder.addFace(mb.QUADS, quad, [atc,btc,ctc,dtc], idx, shade);
  return new ObjectHandle(material, MU.normal([a,b,c]), offset, 6);
}

function addSector(tris:number[][], ceiling:boolean, sector:buildstructs.Sector, walls:buildstructs.Wall[], heinum:number, z:number, slope:any, builder:BoardBuilder, idx:number, material:DS.Material):ObjectHandle {
  var tcscalex = material.getTexture('base').getWidth() * 16;
  var tcscaley = material.getTexture('base').getHeight() * 16;
  var offset = builder.getOffset();
  var normal:number[] = null;
  var shade = ceiling ? sector.ceilingshade : sector.floorshade;
  var vtxs = [];
  var tcs = [];
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

    vtxs = vtxs.concat(ceiling ? [v3,v2,v1] : [v1,v2,v3]); 
    tcs = tcs.concat(ceiling ? [v3tc,v2tc,v1tc] : [v1tc,v2tc,v3tc]);

    if (normal == null) normal = MU.normal(vtxs);
  }
  builder.addFace(mb.TRIANGLES, vtxs, tcs, idx, shade);

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

export class WallGeometry {
  public quads:number[][][] = [];

  public add(a:number[], b:number[], c:number[], d:number[]) {
    this.quads.push([a, b, c, d]);
  }
}

export interface BoardBuilder {
  addFace(type:number, verts:number[][], tcs:number[][], idx:number, shade:number):void;
  getOffset():number;
  build(gl:WebGLRenderingContext):DS.DrawStruct;
}

class DefaultBoardBuilder implements BoardBuilder {
  private builder:mb.MeshBuilder;

  constructor() {
    var gl = WebGLRenderingContext;
    this.builder = new mb.MeshBuilderConstructor()
      .buffer('aPos', Float32Array, gl.FLOAT, 3)
      .buffer('aNorm', Float32Array, gl.FLOAT, 3)
      .buffer('aIdx', Uint8Array, gl.UNSIGNED_BYTE, 4, true)
      .buffer('aTc', Float32Array, gl.FLOAT, 2)
      .buffer('aShade', Int8Array, gl.BYTE, 1)
      .index(Uint16Array, gl.UNSIGNED_SHORT)
      .build();
  }

  public addFace(type:number, verts:number[][], tcs:number[][], idx:number, shade:number) {
    this.builder.start(type)
      .attr('aNorm', MU.normal(verts))
      .attr('aIdx', MU.int2vec4(idx))
      .attr('aShade', [shade]);
    for (var i = 0; i < verts.length; i++){
      this.builder
        .attr('aTc', tcs[i])
        .vtx('aPos', verts[i]);
    }
    this.builder.end();
  }

  public getOffset(): number {
    return this.builder.offset() * 2;
  }

  public build(gl:WebGLRenderingContext):DS.DrawStruct {
    return this.builder.build(gl, null);
  }
}

export class BoardProcessor {
  private walls:WallInfo[] = [];
  private sectors:SectorInfo[] = [];
  private index:any = [];
  private dss:DS.DrawStruct[] = [];

  constructor(public board:buildstructs.Board) {}

  public build(gl:WebGLRenderingContext, materialFactory:MaterialFactory, builder:BoardBuilder=new DefaultBoardBuilder()):BoardProcessor {
    var objs:any = [];

    var idx = 1;
    var sectors = this.board.sectors;
    var walls = this.board.walls;
    for (var s = 0; s < sectors.length; s++) {
      var sectorIdx = idx++;
      var sector = sectors[s];
      this.index[sectorIdx] = [sector, s];

      var slope = createSlopeCalculator(sector, walls);
      var ceilingheinum = sector.ceilingheinum;
      var ceilingz = sector.ceilingz;
      var floorheinum = sector.floorheinum;
      var floorz = sector.floorz;

      var i = 0;
      while (i < sector.wallnum) {
        var w = sector.wallptr + i;
        var wall = walls[w];
        this.index[idx] = [wall, w];
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

    var tmp:mb.Mesh = <mb.Mesh>builder.build(gl);
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
        this.dss.push(wallMesh);
        i++;
      } else if (type == TYPE_WALL) {
        var wallMesh = new mb.Mesh(obj.material, vtxBuf, idxBuf, mode, obj.len, obj.offset)
        this.walls[id] = new WallInfo(obj.normal, wallMesh);
        this.dss.push(wallMesh);
      }

      if (type == TYPE_SECTOR_FLOOR) {
        var floor = new mb.Mesh(obj.material, vtxBuf, idxBuf, mode, obj.len, obj.offset);
        var ceiling = new mb.Mesh(objs[i+1][0].material, vtxBuf, idxBuf, mode, objs[i+1][0].len, objs[i+1][0].offset);
        this.sectors[id] = new SectorInfo(obj.normal, objs[i+1][0].normal, floor, ceiling);
        this.dss.push(floor);
        this.dss.push(ceiling);
        i++;
      }
    }
    return this;
  }

  public getAll():DS.DrawStruct[] {
    return this.dss;
  }

  private getNotInSector(eye:number[]):DS.DrawStruct[] {
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
      var wallinfo = walls[i];
      if (wallinfo == undefined)
        continue;
      if (GLM.vec2.dot(eye, wallinfo.normal) <= fov)
      ds.push(wallinfo.ds);
    }
    return ds;
  }

  private getInSector(ms:MoveStruct, sec:number):DS.DrawStruct[] {
    var ds:DS.DrawStruct[] = [];
    var board = this.board;
    var sectors = this.sectors;
    var walls = this.walls;
    var pvs = [sec];
    for (var i = 0; i < pvs.length; i++) {
      var cursecnum = pvs[i];
      ds.push(sectors[cursecnum].floor);
      ds.push(sectors[cursecnum].ceiling);

      var cursec = board.sectors[cursecnum];
      for (var w = 0; w < cursec.wallnum; w++) {
        var wallidx = cursec.wallptr + w;
        var wall = board.walls[wallidx];
        var wall2 = board.walls[wall.point2];

        var dx = wall2.x - wall.x;
        var dy = wall2.y - wall.y;
        if (dx*(ms.y-wall.y) < dy*(ms.x-wall.x)) continue;

        var wallinfo = walls[wallidx];
        if (wallinfo != undefined) 
          ds.push(wallinfo.ds);

        if (wall.nextsector == -1) continue;

        var nextsector = wall.nextsector;
        if (pvs.indexOf(nextsector) == -1)
          pvs.push(nextsector);
      }
    }
    return ds;
  }

  public get(ms:MoveStruct, eye:number[]):DS.DrawStruct[] {
    var sec = getSector(this.board, ms);
    return sec == -1
      ? this.getNotInSector(eye)
      : this.getInSector(ms, sec)
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
  public xvel:number;
  public yvel:number;
  public zvel:number;
}

class SectorIntersect {
  constructor(
    public t:number,
    public wall:buildstructs.Wall,
    public point:number[]
  ) {}
}

function traceSector(board:buildstructs.Board, secnum:number, sx:number, sy:number, ex:number, ey:number):SectorIntersect {
  var walls = board.walls;
  var sectors = board.sectors;
  var p1s = [sx, sy];
  var p1e = [ex, ey];
  var inter = new SectorIntersect(100.0, null, [0,0]);

  var sec = sectors[secnum];
  var slope = createSlopeCalculator(sec, walls);
  var ceilingheinum = sec.ceilingheinum;
  var ceilingz = sec.ceilingz;
  var floorheinum = sec.floorheinum;
  var floorz = sec.floorz;

  for (var w = 0; w < sec.wallnum; w++) {
    var wallidx = sec.wallptr + w;
    var wall = walls[wallidx];
    var wall2 = walls[wall.point2];
    var x1 = wall.x;
    var y1 = wall.y;
    var x2 = wall2.x;
    var y2 = wall2.y;

    var t = MU.intersect2dT(p1s, p1e, [x1,y1], [x2,y2]);
    if (t == null)
      continue;

    if (t < inter.t) {
      GLM.vec2.lerp(inter.point, p1s, p1e, t);
      inter.t = t;
      inter.wall = wall;
    }
  }
  return inter.t <= 1.0 ? inter : null;
}

// function minIntersection(inters:SectorIntersect[], start:number[], dir:number[]):number {
//   var min = -1;
//   for (var i = 0; i < inters.length; i++) {
//     var inter = inters[i];
//     if (inter == null)
//       continue;

//     if (min == null || min.t > inter.t)
//       min = i; 
//   }
//   return min;
// }

// class SectorHullIntersect {
//    constructor(
//     public t:number,
//     public wall:buildstructs.Wall,
//     public point:number[]
//   ) {}
// }

// function traceSectorHull(board:buildstructs.Board, secnum:number, sx:number, sy:number, ex:number, ey:number, radius:number):SectorIntersect {
//   var s = [sx, sy];
//   var e = [ex, ey];
//   var vec = GLM.vec2.sub(GLM.vec2.create(), e, s);
//   var dir = MU.direction2d(s, e);
//   var cinter = traceSector(board, secnum, sx, sy, ex+dc[0]*radius, ey+dc[1]*radius);
//   var c:SectorIntersect = null;
//   if (cinter != null) {
//     cinter.point[0] -= dir[0];
//     cinter.point[1] -= dir[1];
//     var cvec = GLM.vec2.sub(GLM.vec2.create(), cinter.point, s);
//     var t = GLM.vec2.dot(vec, cvec);
//     c = new SectorIntersect(t, cinter.wall, cinter.point);
//   }

//   var normal = MU.normal2d(s, e);
//   normal[0] *= radius; normal[1] *= radius;

//   var lsx = sx + normal[0], lex = ex + normal[0];
//   var lsy = sy + normal[1], ley = ey + normal[1];
//   var linter = traceSector(board, secnum, lsx, lsy, lex, ley);
//   var l:SectorIntersect = null;
//   if (linter != null) {
//     var lvec = GLM.vec2.sub(GLM.vec2.create(), linter.point, [lsx, lsy])
//     var t = GLM.vec2.dot(vec, lvec);
//     l = new SectorIntersect(t, linter.wall, [linter.point[0]-normal[0], linter.point[1]-normal[1]]);
//   }

//   var rsx = sx - normal[0], rex = ex - normal[0];
//   var rsy = sy - normal[1], rey = ey - normal[1];
//   var rinter = traceSector(board, secnum, rsx, rsy, rex, rey);
//   var r:SectorIntersect = null;
//   if (rinter != null) {
//     var rvec = GLM.vec2.sub(GLM.vec2.create(), rinter.point, [rsx, rsy])
//     var t = GLM.vec2.dot(vec, rvec);
//     r = new SectorIntersect(t, rinter.wall, [rinter.point[0]+normal[0], rinter.point[1]+normal[1]]);
//   }

//   var inters = [c, l, r];
//   var minint = minIntersection(inters, s, dir);
//   if (minint == -1)
//     return null;
//   return inters[minint]; 
// }

export function move(board:buildstructs.Board, ms:MoveStruct, dx:number, dy:number):void {
  if (dx == 0 && dy == 0)
    return;

  var cursecnum = getSector(board, ms);
  if (cursecnum == -1)
    return;
    
  var walls = board.walls;
  var sectors = board.sectors;
  var nx = ms.x + dx;
  var ny = ms.y + dy;

  var enterwallnum = null;
  while (cursecnum != -1) {
    ms.sec = cursecnum;
    var inter = traceSector(board, cursecnum, ms.x, ms.y, nx, ny);

    if (inter != null) {
      cursecnum = inter.wall.nextsector;
      enterwallnum = inter.wall.nextwall;

      if (cursecnum != -1) {
        var nsector = sectors[cursecnum];
        var nslope = createSlopeCalculator(nsector, walls);
        var nf = nslope(inter.point[0], inter.point[1], nsector.floorheinum) + nsector.floorz;
        var diff = ms.z - nf;
        if (diff > 8192)
          cursecnum = -1;
      }

      if (cursecnum == -1) {
        var interwall2 = walls[inter.wall.point2];
        var normal = MU.normal2d([inter.wall.x, inter.wall.y], [interwall2.x, interwall2.y]);
        GLM.vec2.add(inter.point, inter.point, GLM.vec2.scale(normal, normal, 64));
      }
      
      ms.x = inter.point[0];
      ms.y = inter.point[1];
    } else {
      ms.x = nx;
      ms.y = ny;
      break;
    }
  }
}

function findSector(board:buildstructs.Board, x:number, y:number, secnum:number):number {
  var secs = [secnum];
  for (var i = 0; i < secs.length; i++) {
    secnum = secs[i];
    var sec = board.sectors[secnum];
    if (inSector(board, x, y, secnum))
      return secnum;

    for (var w = 0; w < sec.wallnum; w++) {
      var wallidx = w + sec.wallptr;
      var wall = board.walls[wallidx];
      if (wall.nextsector != -1){
        var nextsector = wall.nextsector;
        if (secs.indexOf(nextsector) == -1)
          secs.push(nextsector);
      }
    }
  }
  return -1;
}

function inSector(board:buildstructs.Board, x:number, y:number, secnum:number):boolean {
  if (!secnum)
    return false;
  var sec = board.sectors[secnum];
  var inter = 0;
  for (var w = 0; w < sec.wallnum; w++) {
    var wallidx = w + sec.wallptr;
    var wall = board.walls[wallidx];
    var wall2 = board.walls[wall.point2];
    var dy1 = wall.y - y;
    var dy2 = wall2.y - y;
    if (dy1 == 0 || dy2 == 0)
        continue;

    if (MU.sign(dy1) != MU.sign(dy2)) {
      var d = dy1 / (wall.y - wall2.y);
      var ix = wall.x + d * (wall2.x - wall.x);
      if (ix < x)
        inter++;
    }
  }
  return inter % 2 != 0;
}


function getSector(board:buildstructs.Board, ms:MoveStruct):number {
  if (inSector(board, ms.x, ms.y, ms.sec))
    return ms.sec;
  return -1;
}

export function fall(board:buildstructs.Board, ms:MoveStruct, dz:number):void {
  var secnum = getSector(board, ms);
  if (secnum == -1)
    return;
  var walls = board.walls;
  var sectors = board.sectors;
  var sector = sectors[secnum];
  var slope = createSlopeCalculator(sector, walls);
  var ceilingheinum = sector.ceilingheinum;
  var ceilingz = sector.ceilingz;
  var floorheinum = sector.floorheinum;
  var floorz = sector.floorz;

  var fz = slope(ms.x, ms.y, floorheinum) + floorz;
  var cz = slope(ms.x, ms.y, ceilingheinum) + ceilingz;

  var nz = ms.z + dz;
  if (nz < cz)
    nz = cz;
  else if (nz > fz)
    nz = fz;
  ms.z = nz;
}