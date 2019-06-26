import * as MU from '../../../libs/mathutils';
import * as VEC from '../../../libs/vecmath';
import * as GLM from '../../../libs_js/glmatrix';
import { Board, Sprite, Sector, Wall, FACE, WALL, FLOOR } from './structs';
import { ArtInfoProvider } from './art';

export function getPlayerStart(board:Board):Sprite {
  for (var i = 0; i < board.sprites.length; i++) {
    var sprite = board.sprites[i];
    if (sprite.lotag == 1)
      return sprite;
  }
  return null;
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

export function getSector(board:Board, ms:MoveStruct):number {
  if (inSector(board, ms.x, ms.y, ms.sec))
    return ms.sec;
  return -1;
}

export function inSector(board:Board, x:number, y:number, secnum:number):boolean {
  x = MU.int(x);
  y = MU.int(y);
  var sec = board.sectors[secnum];
  if (sec == undefined)
    return false;
  var inter = 0;
  for (var w = 0; w < sec.wallnum; w++) {
    var wallidx = w + sec.wallptr;
    var wall = board.walls[wallidx];
    var wall2 = board.walls[wall.point2];
    var dy1 = wall.y - y;
    var dy2 = wall2.y - y;

    if ((dy1 ^ dy2) < 0)
    {
      var dx1 = wall.x - x; 
      var dx2 = wall2.x - x;
      if ((dx1 ^ dx2) >= 0)
        inter ^= dx1; 
      else 
        inter ^= MU.cross2d(dx1, dy1, dx2, dy2)^dy2;
    }
  }
  return (inter>>>31) == 1;
}

export function sectorOfWall(board:Board, wallId:number):number {
  if (wallId < 0 || wallId >= board.walls.length)
    return -1;
  var wall = board.walls[wallId];
  if (wall.nextwall != -1)
    return board.walls[wall.nextwall].nextsector;
  var start = 0;
  var end = board.sectors.length - 1;
  while (end - start >= 0) {
    var pivot = MU.int(start + (end - start) / 2);
    var sec = board.sectors[pivot];
    if (sec.wallptr <= wallId && sec.wallptr+sec.wallnum >= wallId)
      return pivot;
    if (sec.wallptr > wallId) {
      end = pivot - 1;
    } else {
      start = pivot + 1;
    }
  }
}

export function findSector(board:Board, x:number, y:number, secnum:number = -1):number {
  if (secnum == -1)
    return findSectorAll(board, x, y);
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

function findSectorAll(board:Board, x:number, y:number) {
  for (var s = 0; s < board.sectors.length; s++) {
    var sec = board.sectors[s];
    if (inSector(board, x, y, s))
      return s;
  }
  return -1;
}

export function getSprites(board:Board, secnum:number):number[] {
  var ret = [];
  var sprites = board.sprites;
  for (var i = 0; i < sprites.length; i++) {
    if (sprites[i].sectnum == secnum)
      ret.push(i);
  }
  return ret;
}

export function groupSprites(sprites:Sprite[]):{[index:number]:number[]} {
  var sec2spr:{[index:number]:number[]} = {};
  for (var s = 0; s < sprites.length; s++) {
    var spr = sprites[s];
    var sprs = sec2spr[spr.sectnum];
    if (sprs == undefined) {
      sprs = [];
      sec2spr[spr.sectnum] = sprs;
    }
    sprs.push(s);
  }
  return sec2spr;
}

var ANGSCALE = (1 / 4096);
var ZSCALE = 16;

export function createSlopeCalculator(sector:Sector, walls:Wall[]) {
  var wall1 = walls[sector.wallptr];
  var wall2 = walls[wall1.point2];
  var dx = wall2.x - wall1.x;
  var dy = wall2.y - wall1.y;
  var ln = MU.len2d(dx, dy);
  dx /= ln; dy /= ln;

  return function (x:number, y:number, heinum:number):number {
    var dx1 = x - wall1.x;
    var dy1 = y - wall1.y;
    var k = MU.cross2d(dx, dy, dx1, dy1);
    return MU.int((heinum * ANGSCALE) * k * ZSCALE);
  };
}

export function lineIntersect(
  x1:number, y1:number, z1:number, 
  x2:number, y2:number, z2:number, 
  x3:number, y3:number, x4:number, y4:number):number[] {

  var x21 = x2 - x1, x34 = x3 - x4;
  var y21 = y2 - y1, y34 = y3 - y4;
  var bot = MU.cross2d(x21, y21, x34, y34);
  
  if (bot == 0) return null;
  
  var x31 = x3 - x1, y31 = y3 - y1;
  var topt = MU.cross2d(x31, y31, x34, y34);

  if (bot > 0) {
    if ((topt < 0) || (topt >= bot))
      return null;
    var topu = MU.cross2d(x21, y31, x31, y31);
    if ((topu < 0) || (topu >= bot))
      return null;
  } else {
    if ((topt > 0) || (topt <= bot))
      return null;
    var topu = MU.cross2d(x21, y21, x31, y31);
    if ((topu > 0) || (topu <= bot))
      return null;
  }

  var t = topt / bot;
  var x = x1 + MU.int(x21 * t);
  var y = y1 + MU.int(y21 * t);
  var z = z1 + MU.int((z2 - z1) * t) * ZSCALE;

  return [x, y, z, t];
}
  
export function  rayIntersect(
  x1:number, y1:number, z1:number, 
  vx:number, vy:number, vz:number, 
  x3:number, y3:number, x4:number, y4:number):number[] {

  var x34 = x3 - x4;
  var y34 = y3 - y4;
  var bot = MU.cross2d(vx, vy, x34, y34);
  if (bot == 0) return null;
  var x31 = x3 - x1;
  var y31 = y3 - y1;
  var topt = MU.cross2d(x31, y31, x34, y34);
 
  if (bot > 0) {
    if (topt < 0) return null;
    var topu = MU.cross2d(vx, vy, x31, y31);
    if ((topu < 0) || (topu >= bot)) 
      return null;
  } else {
    if (topt > 0) return null;
    var topu = MU.cross2d(vx, vy, x31, y31);
    if ((topu > 0) || (topu <= bot))
      return null;
  } 
  
  var t = topt / bot;
  var x = x1 + MU.int(vx * t);
  var y = y1 + MU.int(vy * t);
  var z = z1 + MU.int(vz * t) * ZSCALE;
  
  return [x, y, z, t];
}


export enum HitType {
  FLOOR, CEILING, UPPER_WALL, MID_WALL, LOWER_WALL, SPRITE
}

export function isSector(type:HitType) {
  return type == HitType.FLOOR || type == HitType.CEILING;
}

export function isWall(type:HitType) {
  return type == HitType.LOWER_WALL || type == HitType.MID_WALL || type == HitType.UPPER_WALL;
}

export function isSprite(type:HitType) {
  return type == HitType.SPRITE;
}

export class Hitscan {
  constructor(
    public x:number = -1, 
    public y:number = -1, 
    public z:number = -1,
    public t:number = -1,
    public id:number = -1,
    public type:HitType = null
  ) {}

  public reset() {
    this.id = -1;
    this.t = -1;
    this.type = null;
  }

  private testHit(x:number, y:number, z:number, t:number):boolean {
    if (this.t == -1 || this.t >= t) {
      this.x = x; this.y = y; this.z = z; this.t = t;
      return true;
    }
    return false;
  }

  public hit(x:number, y:number, z:number, t:number, id:number, type:HitType) {
    if (this.testHit(x, y, z, t)) {
      this.id = id;
      this.type = type;
    }
  }
}


function hitSector(board:Board, secId:number, xs:number, ys:number, zs:number, vx:number, vy:number, vz:number, t:number, hit:Hitscan, type:HitType) {
  var x = xs + MU.int(vx * t);
  var y = ys + MU.int(vy * t);
  var z = zs + MU.int(vz * t) * ZSCALE;
  if (inSector(board, x, y, secId))
    hit.hit(x, y, z, t, secId, type);
}

function intersectSectorPlanes(board:Board, sec:Sector, secId:number, xs:number, ys:number, zs:number, vx:number, vy:number, vz:number, hit:Hitscan) {
  var vl = MU.len2d(vx, vy);
  var nvx = vx / vl;
  var nvy = vy / vl;

  var wall1 = board.walls[sec.wallptr]
  var wall2 = board.walls[wall1.point2];
  var dx = wall2.x - wall1.x;
  var dy = wall2.y - wall1.y;
  var dl = MU.len2d(dx, dy);
  if (dl == 0) return;
  var ndx = dx / dl;
  var ndy = dy / dl;

  var angk = MU.cross2d(ndx, ndy, nvx, nvy);
  var slope = createSlopeCalculator(sec, board.walls);

  var ceilk = sec.ceilingheinum * ANGSCALE * angk;
  var dk = ceilk - vz;
  if (dk > 0) {
    var ceilz = slope(xs, ys, sec.ceilingheinum) + sec.ceilingz;
    var ceildz = (zs - ceilz) / ZSCALE;
    var t = ceildz / dk;
    hitSector(board, secId, xs, ys, zs, vx, vy, vz, t, hit, HitType.CEILING);
  }

  var floork = sec.floorheinum * ANGSCALE * angk;
  var dk = vz - floork;
  if (dk > 0) {
    var floorz = slope(xs, ys, sec.floorheinum) + sec.floorz;
    var floordz = (floorz - zs) / ZSCALE;
    var t = floordz / dk;
    hitSector(board, secId, xs, ys, zs, vx, vy, vz, t, hit, HitType.FLOOR);
  }
}

function intersectWall(board:Board, sec:Sector, wall:Wall, wall2:Wall, wallId:number, xs:number, ys:number, zs:number, vx:number, vy:number, vz:number, hit:Hitscan):number {
  var x1 = wall.x, y1 = wall.y;
  var x2 = wall2.x, y2 = wall2.y;

  if ((x1 - xs) * (y2 - ys) < (x2 - xs) * (y1 - ys))
    return -1;

  var intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null)
    return -1;
  var [ix, iy, iz, it] = intersect;

  var nextsecId = wall.nextsector;
  if (nextsecId == -1 || wall.cstat.masking) {
    hit.hit(ix, iy, iz, it, wallId, HitType.MID_WALL);
    return -1;
  }

  var nextsec = board.sectors[nextsecId];
  var nextslope = createSlopeCalculator(nextsec, board.walls);
  var floorz = nextslope(ix, iy, nextsec.floorheinum) + nextsec.floorz;
  var ceilz = nextslope(ix, iy, nextsec.ceilingheinum) + nextsec.ceilingz;
  if (iz <= ceilz) {
    hit.hit(ix, iy, iz, it, wallId, HitType.UPPER_WALL);
    return -1;
  } else if (iz >= floorz) {
    hit.hit(ix, iy, iz, it, wallId, HitType.LOWER_WALL);
    return -1;
  }

  return nextsecId;
}

function intersectSprite(board:Board, artInfo:ArtInfoProvider, spr:Sprite, sprId:number, xs:number, ys:number, zs:number, vx:number, vy:number, vz:number, hit:Hitscan) {
  if (spr.picnum == 0 || spr.cstat.invicible)
    return;
  var x = spr.x, y = spr.y, z = spr.z;
  var info = artInfo.getInfo(spr.picnum);
  if (spr.cstat.type == FACE) {
    var dx = x - xs; var dy = y - ys;
    var vl = MU.sqrLen2d(vx, vy);
    if (vl == 0) return;
    var t = MU.dot2d(vx, vy, dx, dy) / vl;
    if (t <= 0) return;
    var intz = zs + MU.int(vz * t) * ZSCALE;
    var h = info.h * spr.yrepeat << 2;
    if (spr.cstat.realCenter)
      z += (h >> 1);
    z -= info.attrs.yoff * spr.yrepeat << 2;
    if ((intz > z) || (intz < z - h)) return;
    var t1 = MU.cross2d(vx, vy, dx, dy) / vl;
    var offx = MU.int(vx * t1);
    var offy = MU.int(vy * t1);
    var dist = MU.sqrLen2d(offx, offy);
    var w = info.w * spr.xrepeat << 2;
    if (dist > w) return;
    var intx = xs + MU.int(vx * t);
    var inty = ys + MU.int(vy * t);
    hit.hit(intx, inty, intz, t, sprId, HitType.SPRITE);
  } else if (spr.cstat.type == WALL) {
    var xoff = info.attrs.xoff + spr.xoffset;
    if (spr.cstat.xflip) xoff = -xoff;
    var w = (info.w * spr.xrepeat) / 4; var hw = w >> 1;
    var ang = MU.PI2 - (spr.ang / 2048) * MU.PI2;
    var dx = Math.sin(ang)*hw;
    var dy = Math.cos(ang)*hw;
  } else if (spr.cstat.type == FLOOR) {
  }
}

function fillStack(board:Board):number[] {
  var arr = new Array<number>(board.sectors.length);
  for (var i = 0; i < board.sectors.length; i++)
    arr[i] = i;
  return arr;
}

export function hitscan(board:Board, artInfo:ArtInfoProvider, xs:number, ys:number, zs:number, secId:number, vx:number, vy:number, vz:number, hit:Hitscan, cliptype:number) {
  hit.reset();

  var stack = (secId < 0) ? fillStack(board) : [secId];
  var sprites = groupSprites(board.sprites);
  for (var i = 0; i < stack.length; i++) {
    var s = stack[i];
    var sec = board.sectors[s];
    if (sec == undefined) break;
    intersectSectorPlanes(board, sec, s, xs, ys, zs, vx, vy, vz, hit);

    var endwall = sec.wallptr+sec.wallnum;
    for (var w = sec.wallptr; w < endwall; w++) {
      var wall = board.walls[w];
      var wall2 = board.walls[wall.point2];
      if (wall == undefined || wall2 == undefined)
        continue;
      var nextsec = intersectWall(board, sec, wall, wall2, w, xs, ys, zs, vx, vy, vz, hit);
      if (nextsec != -1 && stack.indexOf(nextsec) == -1) {
        stack.push(nextsec);
      }
    }

    var sprs = sprites[s];
    if (sprs == undefined) continue;
    for (var j = 0; j < sprs.length; j++) {
      var sprId = sprs[j];
      var spr = board.sprites[sprId];
      intersectSprite(board, artInfo, spr, sprId, xs, ys, zs, vx, vy, vz, hit);
    }
  }
}  

export function getFirstWallAngle(sector:Sector, walls:Wall[]):number {
  var w1 = walls[sector.wallptr];
  var w2 = walls[w1.point2];
  var dx = w2.x - w1.x;
  var dy = w2.y - w1.y;
  return  Math.atan2(-dy, dx);
}

export function wallVisible(wall1:Wall, wall2:Wall, ms:MoveStruct) {
  var dx1 = wall2.x - wall1.x;
  var dy1 = wall2.y - wall1.y;
  var dx2 = ms.x - wall1.x;
  var dy2 = ms.y - wall1.y;
  return MU.cross2d(dx1, dy1, dx2, dy2) >= 0;
}

export function wallNormal(board:Board, wallId:number):GLM.Vec3Array {
  var w1 = board.walls[wallId];
  var w2 = board.walls[w1.point2];
  var wallNormal = VEC.normal2d(GLM.vec2.create(), [w1.x-w2.x, w1.y-w2.y]);
  return GLM.vec3.fromValues(wallNormal[0], 0, wallNormal[1]);
}

export function sectorNormal(board:Board, sectorId:number, ceiling:boolean):GLM.Vec3Array {
  var sec = board.sectors[sectorId];
  var wn = wallNormal(board, sec.wallptr);
  GLM.vec3.negate(wn, wn);
  var h = ceiling ? sec.ceilingheinum : sec.floorheinum;
  var normal = ceiling ? [0, -1, 0] : [0, 1, 0];
  return GLM.vec3.lerp(normal, normal, wn, Math.atan(h * ANGSCALE) / (Math.PI/2));
}

export function ang2vec(ang:number):GLM.Vec3Array {
  ang += Math.PI/2;
  return GLM.vec3.fromValues(Math.sin(ang), 0, Math.cos(ang))
}
