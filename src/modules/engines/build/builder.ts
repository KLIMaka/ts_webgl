
import buildstructs = require('./structs');
import MU = require('../../../libs/mathutils');
import GLU = require('../../../libs_js/glutess');
import mb = require('../../meshbuilder');
import DS = require('../../drawstruct');
import U = require('./utils');

var SCALE = -16;
var TCBASE = 8192;


function triangulate(sector:buildstructs.Sector, walls:buildstructs.Wall[]):number[][] {
  var i = 0;
  var chains = [];
  while (i < sector.wallnum) {
    var ws = [];
    var firstwallIdx = i + sector.wallptr;
    var wall = walls[sector.wallptr + i];
    ws.push(firstwallIdx);
    while (wall.point2 != firstwallIdx){
      ws.push(wall.point2);
      wall = walls[wall.point2];
      i++;
    }
    i++;
    chains.push(ws);
  }

  var contours = [];
  for (var i = 0; i < chains.length; i++) {
    var contour = [];
    var chain = chains[i];
    for (var j = 0; j < chain.length; j++) {
      var wall = walls[chain[j]];
      contour.push(wall.x, wall.y);
    }
    contours.push(contour);
  }
  return GLU.tesselate(contours);
}


var TYPE_SECTOR_FLOOR = 1;
var TYPE_SECTOR_CEILING = 2;
var TYPE_WALL = 3;

class ObjectHandle {
  constructor(public bbox:MU.BBox, public tex:DS.Texture, public normal:number[], public offset:number, public len:number) {}
}

function len(x:number, y:number) {
  return Math.sqrt(x*x + y*y);
}

function addWall(wall:buildstructs.Wall, builder:BoardBuilder, quad:number[][], idx:number, tex:DS.Texture, base:number):ObjectHandle {
  // a -> b
  // ^    |
  // |    v
  // d <- c
  var xflip = ((wall.cstat & 8) != 0) ? -1 : 1;
  var yflip = ((wall.cstat & 256) != 0) ? -1 : 1;
  var tcscalex = wall.xrepeat / 8.0 / (tex.getWidth() / 64.0) * xflip;
  var tcscaley = (tex.getHeight() * 16) / (wall.yrepeat / 8.0) * yflip;
  var shade = wall.shade;
  var tcxoff = wall.xpanning / tex.getWidth();
  var tcyoff = wall.ypanning * wall.yrepeat;

  var a = quad[0]; var atc = [tcxoff,          (tcyoff+base-a[1])/tcscaley];
  var b = quad[1]; var btc = [tcxoff+tcscalex, (tcyoff+base-b[1])/tcscaley];
  var c = quad[2]; var ctc = [tcxoff+tcscalex, (tcyoff+base-c[1])/tcscaley];
  var d = quad[3]; var dtc = [tcxoff,          (tcyoff+base-d[1])/tcscaley];
  var offset = builder.getOffset();
  var bbox = MU.bbox(quad);

  if (a[1] == d[1]) {
    builder.addFace(mb.TRIANGLES, [a,b,c], [atc,btc,ctc], idx, shade);
    return new ObjectHandle(bbox, tex, MU.normal([a,b,c]), offset, 3);
  }
  if (b[1] == c[1]) {
    builder.addFace(mb.TRIANGLES, [a,b,d], [atc,btc,dtc], idx, shade);
    return new ObjectHandle(bbox, tex, MU.normal([a,b,d]), offset, 3);
  }
  if (a[1] < d[1] && b[1] < c[1]){
    builder.addFace(mb.QUADS, [d,c,b,a], [dtc,ctc,btc,atc], idx, shade);
    return new ObjectHandle(bbox, tex, MU.normal([d,c,b,a]), offset, 6);
  }

  if (a[1] < d[1]) {
    var e = MU.intersect3d(a,b,c,d);
    var etc = [len(e[0], e[2])/tcscalex, (base-e[1])/tcscaley];
    builder.addFace(mb.TRIANGLES, [d,e,a], [dtc,etc,atc], idx, shade);
    builder.addFace(mb.TRIANGLES, [e,b,c], [etc,btc,ctc], idx, shade);
    return new ObjectHandle(bbox, tex, MU.normal([d,e,a]), offset, 6);
  }
  if (b[1] < c[1]) {
    var e = MU.intersect3d(a,b,c,d);
    var etc = [len(e[0], e[2])/tcscalex, (base-e[1])/tcscaley];
    builder.addFace(mb.TRIANGLES, [a,e,d], [atc,etc,dtc], idx, shade);
    builder.addFace(mb.TRIANGLES, [e,c,b], [etc,ctc,btc], idx, shade);
    return new ObjectHandle(bbox, tex, MU.normal([a,e,d]), offset, 6);
  }

  builder.addFace(mb.QUADS, quad, [atc,btc,ctc,dtc], idx, shade);
  return new ObjectHandle(bbox, tex, MU.normal([a,b,c]), offset, 6);
}

function addSector(tris:number[][], ceiling:boolean, sector:buildstructs.Sector, walls:buildstructs.Wall[], heinum:number, z:number, slope:any, builder:BoardBuilder, idx:number, tex:DS.Texture):ObjectHandle {
  var tcscalex = tex.getWidth() * 16;
  var tcscaley = tex.getHeight() * 16;
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
  var bbox = MU.bbox(vtxs);

  return new ObjectHandle(bbox, tex, normal, offset, tris.length);
}

function addSprite(spr:buildstructs.Sprite, builder:BoardBuilder, tex:DS.Texture):ObjectHandle {
  return null;
}

export interface TextureProvider {
  get(picnum:number):DS.Texture;
}

export interface MaterialFactory {
  solid(tex:DS.Texture):DS.Material;
  sprite(tex:DS.Texture):DS.Material;
}

class WallInfo {
  constructor(public bbox:MU.BBox, public normal:number[], public ds:DS.DrawStruct){}
}

class SectorInfo {
  constructor(public bbox:MU.BBox, public floorNormal:number[], public ceilingNormal:number[], public floor:DS.DrawStruct, public ceiling:DS.DrawStruct){}
}

class SpriteInfo {
  constructor(public bbox:MU.BBox, public ds:DS.DrawStruct) {}
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

  public build(gl:WebGLRenderingContext, textureProvider:TextureProvider, materials:MaterialFactory, builder:BoardBuilder=new DefaultBoardBuilder()):BoardProcessor {
    var objs:any = [];

    var idx = 1;
    var sectors = this.board.sectors;
    var walls = this.board.walls;
    for (var s = 0; s < sectors.length; s++) {
      var sectorIdx = idx++;
      var sector = sectors[s];
      this.index[sectorIdx] = [sector, s];

      var slope = U.createSlopeCalculator(sector, walls);
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
        var tex = textureProvider.get(wall.picnum);

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
          var wallobj = addWall(wall, builder, [a, b, c, d], idx, tex, base / SCALE);
          objs.push([wallobj, TYPE_WALL, w]);
        } else {
          var nextsector = sectors[wall.nextsector];
          var nextslope = U.createSlopeCalculator(nextsector, walls);
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
            var wallobj = addWall(wall_, builder, [a, b, c, d], idx, textureProvider.get(wall_.picnum), base / SCALE)
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
            var wallobj = addWall(wall, builder, [a, b, c, d], idx, tex, base / SCALE);
            objs.push([wallobj, TYPE_WALL, w]);
          }
        }
        i++;
        idx++;
      }

      var tris:number[][] = triangulate(sector, walls);
      if (tris.length == 0)
        continue;
      var floorObj = addSector(tris, false, sector, walls, floorheinum, floorz, slope, builder, sectorIdx, textureProvider.get(sector.floorpicnum));
      objs.push([floorObj, TYPE_SECTOR_FLOOR, s]);
      var ceilingObj = addSector(tris, true, sector, walls, ceilingheinum, ceilingz, slope, builder, sectorIdx, textureProvider.get(sector.ceilingpicnum));
      objs.push([ceilingObj, TYPE_SECTOR_CEILING, s]);

      // var sprites = U.getSprites(this.board, s);
      // for (var i = 0; i < sprites.length; i++) {
      //   var spr = sprites[i];
      //   var mat = textureProvider.get(spr.picnum);
      // }
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
        var mat = materials.solid(obj.tex);
        var len = obj.len + objs[i+1][0].len;
        var wallMesh = new mb.Mesh(mat, vtxBuf, idxBuf, mode, len, obj.offset);
        this.walls[id] = new WallInfo(obj.bbox, obj.normal, wallMesh);
        this.dss.push(wallMesh);
        i++;
      } else if (type == TYPE_WALL) {
        var mat = materials.solid(obj.tex);
        var wallMesh = new mb.Mesh(mat, vtxBuf, idxBuf, mode, obj.len, obj.offset)
        this.walls[id] = new WallInfo(obj.bbox, obj.normal, wallMesh);
        this.dss.push(wallMesh);
      }

      if (type == TYPE_SECTOR_FLOOR) {
        var floormat = materials.solid(obj.tex);
        var ceilmat = materials.solid(objs[i+1][0].tex);
        var floor = new mb.Mesh(floormat, vtxBuf, idxBuf, mode, obj.len, obj.offset);
        var ceiling = new mb.Mesh(ceilmat, vtxBuf, idxBuf, mode, objs[i+1][0].len, objs[i+1][0].offset);
        this.sectors[id] = new SectorInfo(obj.bbox, obj.normal, objs[i+1][0].normal, floor, ceiling);
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

  private getNotInSector(ms:U.MoveStruct, eye:number[]):DS.DrawStruct[] {
    var ds:DS.DrawStruct[] = [];
    var sectors = this.sectors;
    var walls = this.walls;
    var fov = 0;
    for (var i = 0; i < sectors.length; i++) {
      var sector = sectors[i];
      if (sector == undefined)
        continue;
      if (bboxVisible(ms, eye, sector.bbox, null)) {
        ds.push(sector.floor);
        ds.push(sector.ceiling);
      }
    }
    for (var i = 0; i < walls.length; i++) {
      var wallinfo = walls[i];
      if (wallinfo == undefined)
        continue;
      if (bboxVisible(ms, eye, wallinfo.bbox, wallinfo.normal))
        ds.push(wallinfo.ds);
    }
    return ds;
  }

  private getInSector(ms:U.MoveStruct):DS.DrawStruct[] {
    var ds:DS.DrawStruct[] = [];
    var board = this.board;
    var sectors = this.sectors;
    var walls = this.walls;
    var pvs = [ms.sec];
    for (var i = 0; i < pvs.length; i++) {
      var cursecnum = pvs[i];

      if (sectors[cursecnum] != undefined) {
        ds.push(sectors[cursecnum].floor);
        ds.push(sectors[cursecnum].ceiling);
      }

      var cursec = board.sectors[cursecnum];
      for (var w = 0; w < cursec.wallnum; w++) {
        var wallidx = cursec.wallptr + w;
        var wall = board.walls[wallidx];
        var wall2 = board.walls[wall.point2];

        var dx1 = wall2.x - wall.x;
        var dy1 = wall2.y - wall.y;
        var dx2 = ms.x - wall.x;
        var dy2 = ms.y - wall.y;
        if (dx1*dy2 < dy1*dx2) continue;

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

  public get(ms:U.MoveStruct, eye:number[]):DS.DrawStruct[] {
    if (!U.inSector(this.board, ms.x, ms.y, ms.sec)) {
      ms.sec = U.findSector(this.board, ms.x, ms.y, ms.sec);
    }
    return ms.sec == -1
      ? this.getNotInSector(ms, eye)
      : this.getInSector(ms)
  }

  public getByIdx(idx:number):any {
    return this.index[idx];
  }
}

function bboxVisible(ms:U.MoveStruct, eye:number[], bbox:MU.BBox, normal:number[]):boolean {
  var dmaxx = bbox.maxx-ms.x
  var dmaxz = bbox.maxz-ms.y;
  var dminx = bbox.minx-ms.x;
  var dminz = bbox.minz-ms.y;
  if ((dmaxx*eye[0] + dmaxz*eye[2]) > 0) return true;
  if ((dmaxx*eye[0] + dminz*eye[2]) > 0) return true;
  if ((dminx*eye[0] + dmaxz*eye[2]) > 0) return true;
  if ((dminx*eye[0] + dminz*eye[2]) > 0) return true;
  return false;
}
