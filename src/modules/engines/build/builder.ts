
import buildstructs = require('./structs');
import MU = require('../../../libs/mathutils');
import VEC = require('../../../libs/vecmath');
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

function addWall(wall:buildstructs.Wall, builder:BoardBuilder, quad:number[][], idx:number, tex:DS.Texture, mat:DS.Material, base:number):SolidInfo {
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

  builder.begin();

  var a = quad[0]; var atc = [tcxoff,          (tcyoff+base-a[1])/tcscaley];
  var b = quad[1]; var btc = [tcxoff+tcscalex, (tcyoff+base-b[1])/tcscaley];
  var c = quad[2]; var ctc = [tcxoff+tcscalex, (tcyoff+base-c[1])/tcscaley];
  var d = quad[3]; var dtc = [tcxoff,          (tcyoff+base-d[1])/tcscaley];

  if (a[1] == d[1]) {
    builder.addFace(mb.TRIANGLES, [a,b,c], [atc,btc,ctc], idx, shade);
  } else if (b[1] == c[1]) {
    builder.addFace(mb.TRIANGLES, [a,b,d], [atc,btc,dtc], idx, shade);
  } else if (a[1] < d[1] && b[1] < c[1]){
    builder.addFace(mb.QUADS, [d,c,b,a], [dtc,ctc,btc,atc], idx, shade);
  } else if (a[1] < d[1]) {
    var e = VEC.detach3d(VEC.intersect3d(a,b,c,d));
    var etc = [MU.len2d(e[0], e[2])/tcscalex, (base-e[1])/tcscaley];
    builder.addFace(mb.TRIANGLES, [d,e,a], [dtc,etc,atc], idx, shade);
    builder.addFace(mb.TRIANGLES, [e,b,c], [etc,btc,ctc], idx, shade);
  } else if (b[1] < c[1]) {
    var e = VEC.detach3d(VEC.intersect3d(a,b,c,d));
    var etc = [MU.len2d(e[0], e[2])/tcscalex, (base-e[1])/tcscaley];
    builder.addFace(mb.TRIANGLES, [a,e,d], [atc,etc,dtc], idx, shade);
    builder.addFace(mb.TRIANGLES, [e,c,b], [etc,ctc,btc], idx, shade);
  } else {
    builder.addFace(mb.QUADS, quad, [atc,btc,ctc,dtc], idx, shade);
  }

  var mesh = builder.end(mat);
  var bbox = MU.bbox(quad);
  var normal = VEC.detach3d(VEC.polygonNormal([a,b,c]));

  return new SolidInfo(bbox, normal, mesh);
}

function addSector(tris:number[][], ceiling:boolean, sector:buildstructs.Sector, walls:buildstructs.Wall[], builder:BoardBuilder, idx:number, tex:DS.Texture, mat:DS.Material):SolidInfo {
  var heinum = ceiling ? sector.ceilingheinum : sector.floorheinum;
  var z = ceiling ? sector.ceilingz : sector.floorz;
  var slope = U.createSlopeCalculator(sector, walls);
  var tcscalex = tex.getWidth() * 16;
  var tcscaley = tex.getHeight() * 16;
  var shade = ceiling ? sector.ceilingshade : sector.floorshade;
  var vtxs = [];
  var tcs = [];
  var normal:number[] = null;
  builder.begin();
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

    if (normal == null) normal = VEC.detach3d(VEC.polygonNormal(vtxs));
  }
  builder.addFace(mb.TRIANGLES, vtxs, tcs, idx, shade);
  var mesh = builder.end(mat);
  var bbox = MU.bbox(vtxs);

  return new SolidInfo(bbox, normal, mesh);
}

function addSprite(spr:buildstructs.Sprite, builder:BoardBuilder, tex:DS.Texture, materials:MaterialFactory, tinfo:number, idx:number):SpriteInfo {
  var x = spr.x; var y = spr.y; var z = spr.z / SCALE;
  var w = tex.getWidth(); var hw = (w*spr.xrepeat) / 2 / 4;
  var h = tex.getHeight(); var hh = (h*spr.yrepeat) / 2 / 4;
  var ang = MU.PI2 - (spr.ang / 2048)*MU.PI2;
  var xf = (spr.cstat & 0x04) == 0x04;
  var yf = (spr.cstat & 0x08) == 0x08;
  var xo = (tinfo >> 8) & 0xFF; xo = MU.ubyte2byte(xo)*16 * (spr.xrepeat/64);
  var yo = (tinfo >> 16) & 0xFF; yo = MU.ubyte2byte(yo)*16 * (spr.yrepeat/64);
  var tcs = [[xf?0:1, yf?0:1], [xf?1:0, yf?0:1], [xf?1:0, yf?1:0], [xf?0:1, yf?1:0]];
  var vtxs:number[][] = null;
  var mat:DS.Material =  null;

  if ((spr.cstat & 0x30) == 0x00) { // face
    var pos = [x, z, y];
    var a = [-hw, -hh+yo, 0];
    var b = [-hw, +hh+yo, 0];
    var c = [+hw, +hh+yo, 0];
    var d = [+hw, -hh+yo, 0];
    vtxs = [d, a, b, c];
    mat = materials.sprite(tex);
    var bbox = MU.bbox(vtxs);
    builder.begin();
    builder.addSprite(vtxs, pos, tcs, idx, spr.shade);
    var mesh = builder.end(mat);
    return new SpriteInfo(bbox, mesh, true);
  } else if ((spr.cstat & 0x30) == 0x10) { // wall
    var dx = Math.sin(ang)*hw;
    var dy = Math.cos(ang)*hw;
    
    var a = [x-dx, z-hh+yo, y-dy];
    var b = [x+dx, z-hh+yo, y+dy];
    var c = [x+dx, z+hh+yo, y+dy];
    var d = [x-dx, z+hh+yo, y-dy];
    vtxs = [a, b, c, d];
    mat = materials.solid(tex);
  } else if ((spr.cstat & 0x30) == 0x20) { // floor
    var dwx = Math.sin(ang)*hw;
    var dwy = Math.cos(ang)*hw;
    var dhx = Math.sin(ang+Math.PI/2)*hh;
    var dhy = Math.cos(ang+Math.PI/2)*hh;

    var a = [x-dwx-dhx, z+1, y-dwy-dhy];
    var b = [x+dwx+dhx, z+1, y-dwy-dhy];
    var c = [x+dwx+dhx, z+1, y+dwy+dhy];
    var d = [x-dwx-dhx, z+1, y+dwy+dhy];
    vtxs = [a, b, c, d];
    mat = materials.solid(tex);
  }

  var bbox = MU.bbox(vtxs);
  builder.begin();
  builder.addFace(mb.QUADS, vtxs, tcs, idx, spr.shade);
  if ((spr.cstat&0x40)==0) {
    vtxs.reverse(); tcs.reverse();
    builder.addFace(mb.QUADS, vtxs, tcs, idx, spr.shade);
  }
  var mesh = builder.end(mat);
  return new SpriteInfo(bbox, mesh);
}

export interface ArtProvider {
  get(picnum:number):DS.Texture;
  getInfo(picnum:number):number;
}

export interface MaterialFactory {
  solid(tex:DS.Texture):DS.Material;
  sprite(tex:DS.Texture):DS.Material;
}

class DrawStruct {
  public ptr = [WebGLRenderingContext.TRIANGLES, 0, 0];
  public tex = {};
  constructor(offset:number, length:number, tex:DS.Texture) {
    this.ptr[1] = offset;
    this.ptr[2] = length;
    this.tex['base'] = tex;
  }
}

class SolidInfo {
  constructor(public bbox:MU.BBox, public normal:number[], public ds:DS.DrawStruct) {}
}

class WallInfo {
  constructor(public up:SolidInfo, public down:SolidInfo){}
}

class SectorInfo {
  constructor(public floor:SolidInfo, public ceiling:SolidInfo){}
}

class SpriteInfo {
  constructor(public bbox:MU.BBox, public ds:DS.DrawStruct, public face:boolean=false) {}
}

export interface BoardBuilder {
  addFace(type:number, verts:number[][], tcs:number[][], idx:number, shade:number):void;
  addSprite(verts:number[][], pos:number[], tcs:number[][], idx:number, shader:number):void;
  begin():void;
  end(mat:DS.Material):DS.DrawStruct;
  finish(gl:WebGLRenderingContext):void;
}

class DefaultBoardBuilder implements BoardBuilder {
  private builder:mb.MeshBuilder;
  private off = 0;
  private len = 0;
  private vtxBuf:DS.VertexBuffer[];
  private idxBuf:DS.IndexBuffer;
  private mode:number;

  constructor(gl:WebGLRenderingContext) {
    this.builder = new mb.MeshBuilderConstructor()
      .buffer('aPos', Float32Array, gl.FLOAT, 3)
      .buffer('aNorm', Float32Array, gl.FLOAT, 3)
      .buffer('aIdx', Uint8Array, gl.UNSIGNED_BYTE, 4, true)
      .buffer('aTc', Float32Array, gl.FLOAT, 2)
      .buffer('aShade', Int8Array, gl.BYTE, 1)
      .index(Uint16Array, gl.UNSIGNED_SHORT)
      .build();

    var tmp = this.builder.build(gl, null);
    this.vtxBuf = tmp.getVertexBuffers();
    this.idxBuf = tmp.getIndexBuffer();
    this.mode = tmp.getMode();
  }

  public addFace(type:number, verts:number[][], tcs:number[][], idx:number, shade:number):void {
    this.builder.start(type)
      .attr('aNorm', VEC.detach3d(VEC.polygonNormal(verts)))
      .attr('aIdx', MU.int2vec4(idx))
      .attr('aShade', [shade]);
    for (var i = 0; i < verts.length; i++){
      this.builder
        .attr('aTc', tcs[i])
        .vtx('aPos', verts[i]);
    }
    this.builder.end();
    this.len += (type == mb.QUADS ? (6*verts.length/4) : verts.length);
  }

  public addSprite(verts:number[][], pos:number[], tcs:number[][], idx:number, shade:number):void {
    this.builder.start(mb.QUADS)
      .attr('aPos', pos)
      .attr('aIdx', MU.int2vec4(idx))
      .attr('aShade', [shade]);
    for (var i = 0; i < 4; i++){
      this.builder
        .attr('aTc', tcs[i])
        .vtx('aNorm', verts[i]);
    }
    this.builder.end();
    this.len += 6;
  }

  public begin() {
    this.off = this.builder.offset()*2;
    this.len = 0;
  }

  public end(mat:DS.Material):DS.DrawStruct {
    return new mb.Mesh(mat, this.vtxBuf, this.idxBuf, this.mode, this.len, this.off);
  }

  public finish(gl:WebGLRenderingContext) {
    this.builder.build(gl, null);
  }
}

function getVtxs(x1:number, y1:number, x2:number, y2:number, slope:any, nextslope:any, heinum:number, nextheinum:number, z:number, nextz:number, check:boolean) {
  var z1 = (slope(x1, y1, heinum) + z) / SCALE; 
  var z2 = (slope(x2, y2, heinum) + z) / SCALE;
  var z3 = (nextslope(x2, y2, nextheinum) + nextz) / SCALE;
  var z4 = (nextslope(x1, y1, nextheinum) + nextz) / SCALE;
  if (check && (z4 > z1 || z3 > z2))
    return null;
  var a = [x1, z1, y1];
  var b = [x2, z2, y2];
  var c = [x2, z3, y2];
  var d = [x1, z4, y1];
  return [a, b, c, d];
}

export class BoardProcessor {
  private walls:WallInfo[] = [];
  private sectors:SectorInfo[] = [];
  private sprites:SpriteInfo[] = [];
  private spritesBySector:number[][] = [];
  private index:any = [];
  private dss:DS.DrawStruct[] = [];

  constructor(public board:buildstructs.Board) {}

  public build(gl:WebGLRenderingContext, textureProvider:ArtProvider, materials:MaterialFactory, builder:BoardBuilder=new DefaultBoardBuilder(gl)):BoardProcessor {

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
          var vtxs = getVtxs(x1, y1, x2, y2, slope, slope, ceilingheinum, floorheinum, ceilingz, floorz, false);
          var base = ((wall.cstat & 4) != 0) ? floorz : ceilingz;
          var solid = addWall(wall, builder, vtxs, idx, tex, materials.solid(tex), base / SCALE);
          this.walls[w] = new WallInfo(solid, null);
        } else {
          var nextsector = sectors[wall.nextsector];
          var nextslope = U.createSlopeCalculator(nextsector, walls);
          var nextfloorz = nextsector.floorz;
          var nextceilingz = nextsector.ceilingz;
          var up:SolidInfo = null;
          var down:SolidInfo = null;

          var nextfloorheinum = nextsector.floorheinum;
          var vtxs = getVtxs(x1, y1, x2, y2, nextslope, slope, nextfloorheinum, floorheinum, nextfloorz, floorz, true);
          if (vtxs != null) {
            var wall_ = ((wall.cstat & 2) != 0) ? walls[wall.nextwall] : wall;
            var tex_ = textureProvider.get(wall_.picnum);
            var base = ((wall.cstat & 4) != 0) ? ceilingz : nextfloorz;
            up = addWall(wall_, builder, vtxs, idx, tex_, materials.solid(tex_), base / SCALE);
            this.dss.push(up.ds);
          }

          var nextceilingheinum = nextsector.ceilingheinum;
          var vtxs = getVtxs(x1, y1, x2, y2, slope, nextslope, ceilingheinum, nextceilingheinum, ceilingz, nextceilingz, true);
          if (vtxs != null) {
            var base = ((wall.cstat & 4) != 0) ? ceilingz : nextceilingz;
            down = addWall(wall, builder, vtxs, idx, tex, materials.solid(tex), base / SCALE);
            this.dss.push(down.ds);
          }
          if (up != null || down != null) {
            if (up == null)
              this.walls[w] = new WallInfo(down, up);
            else 
              this.walls[w] = new WallInfo(up, down);
          }
        }
        i++;
        idx++;
      }

      var tris = triangulate(sector, walls);
      if (tris.length == 0)
        continue;

      var floortex = textureProvider.get(sector.floorpicnum);
      var ceilingtex = textureProvider.get(sector.ceilingpicnum);
      var floor = addSector(tris, false, sector, walls, builder, sectorIdx, floortex, materials.solid(floortex));
      var ceiling = addSector(tris, true, sector, walls, builder, sectorIdx, ceilingtex, materials.solid(ceilingtex));
      this.sectors[s] = new SectorInfo(floor, ceiling);
      this.dss.push(floor.ds, ceiling.ds);

      var sprites = U.getSprites(this.board, s);
      this.spritesBySector[s] = sprites;
      for (var i = 0; i < sprites.length; i++) {
        var sprite = sprites[i];
        var spr = this.board.sprites[sprite];
        this.index[idx] = [spr, sprite];
        if (spr.picnum == 0)
          continue;
        var tex = textureProvider.get(spr.picnum);
        var tinfo = textureProvider.getInfo(spr.picnum);
        var spriteInfo = addSprite(spr, builder, tex, materials, tinfo, idx);
        this.sprites[sprite] = spriteInfo;
        this.dss.push(spriteInfo.ds);
        idx++;
      }
    }
    builder.finish(gl);
    return this;
  }

  public getAll():DS.DrawStruct[] {
    return this.dss;
  }

  private getNotInSector(ms:U.MoveStruct, eye:number[]):DS.DrawStruct[] {
    var ds:DS.DrawStruct[] = [];
    var sectors = this.sectors;
    var walls = this.walls;
    var sprites = this.sprites;
    var fov = 0;
    for (var i = 0; i < sectors.length; i++) {
      var sector = sectors[i];
      if (sector == undefined)
        continue;
      if (bboxVisible(ms, eye, sector.floor.bbox, sector.floor.normal))
        ds.push(sector.floor.ds);
      if (bboxVisible(ms, eye, sector.ceiling.bbox, sector.ceiling.normal))
        ds.push(sector.ceiling.ds);
    }
    for (var i = 0; i < walls.length; i++) {
      var wallinfo = walls[i];
      if (wallinfo == undefined)
        continue;
      if (bboxVisible(ms, eye, wallinfo.up.bbox, wallinfo.up.normal))
        ds.push(wallinfo.up.ds);
      if (wallinfo.down != null && bboxVisible(ms, eye, wallinfo.down.bbox, wallinfo.down.normal))
        ds.push(wallinfo.down.ds);
    }
    for (var i = 0; i < sprites.length; i++) {
      var spriteInfo = sprites[i];
      if (spriteInfo == null)
        continue;
      if (bboxVisible(ms, eye, spriteInfo.bbox, null))
        ds.push(spriteInfo.ds);
    }
    return ds;
  }

  private getInSector(ms:U.MoveStruct):DS.DrawStruct[] {
    var ds:DS.DrawStruct[] = [];
    var dss:DS.DrawStruct[] = [];
    var board = this.board;
    var sectors = this.sectors;
    var walls = this.walls;
    var pvs = [ms.sec];
    for (var i = 0; i < pvs.length; i++) {
      var cursecnum = pvs[i];

      if (sectors[cursecnum] != undefined) {
        ds.push(sectors[cursecnum].floor.ds);
        ds.push(sectors[cursecnum].ceiling.ds);
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
        if (wallinfo != undefined) {
          ds.push(wallinfo.up.ds);
          if (wallinfo.down != null)
            ds.push(wallinfo.down.ds);
        }

        var nextsector = wall.nextsector;
        if (nextsector == -1) continue;

        if (pvs.indexOf(nextsector) == -1)
          pvs.push(nextsector);
      }

      var sprites = this.spritesBySector[cursecnum];
      if (sprites != undefined) {
        for (var s = 0; s < sprites.length; s++) {
          var spr = this.sprites[sprites[s]];
          if (spr != undefined){
            (spr.face ? dss : ds).push(spr.ds);
          }
        }
      }
    }
    return ds.concat(dss);
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
