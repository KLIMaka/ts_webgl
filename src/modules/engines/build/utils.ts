import * as BS from './structs';
import * as MU from '../../../libs/mathutils';
import * as VEC from '../../../libs/vecmath';

export function getPlayerStart(board:BS.Board):BS.Sprite {
  for (var i = 0; i < board.numsprites; i++) {
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

export function getSector(board:BS.Board, ms:MoveStruct):number {
  if (inSector(board, ms.x, ms.y, ms.sec))
    return ms.sec;
  return -1;
}

export function inSector(board:BS.Board, x:number, y:number, secnum:number):boolean {
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
        inter ^= (dx1*dy2-dx2*dy1)^dy2;
    }
  }
  return (inter>>>31) == 1;
}

export function findSector(board:BS.Board, x:number, y:number, secnum:number = 0):number {
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

function findSectorAll(board:BS.Board, x:number, y:number) {
  for (var s = 0; s < board.sectors.length; s++) {
    var sec = board.sectors[s];
    if (inSector(board, x, y, s))
      return s;
  }
  return -1;
}

export function getSprites(board:BS.Board, secnum:number):number[] {
  var ret = [];
  var sprites = board.sprites;
  for (var i = 0; i < sprites.length; i++) {
    if (sprites[i].sectnum == secnum)
      ret.push(i);
  }
  return ret;
}

var UNITS2DEG = (1 / 4096);
var SCALE = -16;

export function createSlopeCalculator(sector:BS.Sector, walls:BS.Wall[]) {
  var wall1 = walls[sector.wallptr];
  var wall2 = walls[wall1.point2];
  var nx = -wall2.y + wall1.y;
  var ny = wall2.x - wall1.x;
  var ln = MU.len2d(nx, ny);
  nx /= ln; ny /= ln;
  var w = -nx*wall1.x - ny*wall1.y;

  return function (x:number, y:number, rotation:number):number {
    var dist = nx*x + ny*y + w;
    return MU.int(-(rotation * UNITS2DEG) * dist * SCALE);
  };
}

export function lineIntersect(
  x1:number, y1:number, z1:number, 
  x2:number, y2:number, z2:number, 
  x3:number, y3:number, x4:number, y4:number):number[] {

  var x21 = x2 - x1, x34 = x3 - x4;
  var y21 = y2 - y1, y34 = y3 - y4;
  var bot = x21 * y34 - y21 * x34;
  
  if (bot == 0) return null;
  
  var x31 = x3 - x1, y31 = y3 - y1;
  var topt = x31 * y34 - y31 * x34;

  if (bot > 0) {
    if ((topt < 0) || (topt >= bot))
      return null;
    var topu = x21 * y31 - y21 * x31;
    if ((topu < 0) || (topu >= bot))
      return null;
  } else {
    if ((topt > 0) || (topt <= bot))
      return null;
    var topu = x21 * y31 - y21 * x31;
    if ((topu > 0) || (topu <= bot))
      return null;
  }

  var t = topt / bot;
  var x = x1 + MU.int(x21 * t);
  var y = y1 + MU.int(y21 * t);
  var z = z1 + MU.int((z2 - z1) * t);

  return [x, y, z];
}
  
export function  rayIntersect(
  x1:number, y1:number, z1:number, 
  vx:number, vy:number, vz:number, 
  x3:number, y3:number, x4:number, y4:number):number[] {

  var x34 = x3 - x4;
  var y34 = y3 - y4;
  var bot = vx * y34 - vy * x34;
  if (bot == 0) return null;
  var x31 = x3 - x1;
  var y31 = y3 - y1;
  var topt = x31 * y34 - y31 * x34;
 
  if (bot > 0) {
    if (topt < 0) return null;
    var topu = vx * y31 - vy * x31;
    if ((topu < 0) || (topu >= bot)) 
      return null;
  } else {
    if (topt > 0) return null;
    var topu = vx * y31 - vy * x31;
    if ((topu > 0) || (topu <= bot))
      return null;
  } 
  
  var t = topt / bot;
  var x = x1 + MU.int(vx * t);
  var y = y1 + MU.int(vy * t);
  var z = z1 + MU.int(vz * t);
  
  return [x, y, z];
}


export class Hitscan {
  constructor(
    public hitx:number = -1, 
    public hity:number = -1, 
    public hitz:number = -1,
    public hitsect:number = -1,
    public hitwall:number = -1, 
    public hitsprite:number = -1
  ) {}
}

function cross(x1:number, y1:number, x2:number, y2:number) {
  return x1*y2 - y1*x2;
}

function intersectSectorPlane(board:BS.Board, secId:number, xs:number, ys:number, zs:number, vx:number, vy:number, vz:number, hit:Hitscan) {
  var sec = board.sectors[secId];
  if (sec == undefined) return;
  var x1 = 0x7fffffff, y1 = 0, z1 = 0;
  if (sec.ceilingstat.slopped) {
    var wall1 = board.walls[sec.wallptr]
    var wall2 = board.walls[wall1.point2];
    var dx = wall2.x - wall1.x;  // 0
    var dy = wall2.y - wall1.y;  // 2048
    var l = MU.int(MU.len2d(dx, dy)); // 2048
    if (l == 0) return;
    dx /= l; // 0
    dy /= l; // 1
    var dz = cross(dx, dy, vx, vy) * sec.ceilingheinum; // 0
    var angdiff = (vz << 8) - dz; // vz<<8
    if (angdiff != 0) {
      var dx1 = xs - wall1.x; // 0
      var dy1 = ys - wall1.y; // 0
      var i = ((sec.ceilingz - zs) << 8) + cross(dx, dy, dx1, dy1); // 1024
      if (((i ^ angdiff) >= 0) && (Math.abs(i) >> 1) < Math.abs(angdiff)) {
        var k = i / angdiff;
        x1 = MU.int(xs + vx * k);
        y1 = MU.int(ys + vy * k);
        z1 = MU.int(zs + vz * k);
      }
    }
  }
}

export function hitscan(board:BS.Board, xs:number, ys:number, zs:number, secId:number, vx:number, vy:number, vz:number, hit:Hitscan, cliptype:number):number {
  hit.hitsect = -1;
  hit.hitwall = -1;
  hit.hitsprite = -1;
  if (secId < 0) return -1;
  hit.hitx = (1 << 29) - 1;
  hit.hity = (1 << 29) - 1;

  var stack = [secId];
  for (var i = 0; i < stack.length; i++) {
    var s = stack[i];
    var sec = board.sectors[s];
    if (sec == undefined) break;
    var x1 = 0x7fffffff;
    if (sec.ceilingstat.slopped) {

    }
  }
}  


export function getFirstWallAngle(sector:BS.Sector, walls:BS.Wall[]):number {
  var w1 = walls[sector.wallptr];
  var w2 = walls[w1.point2];
  var dx = w2.x - w1.x;
  var dy = w2.y - w1.y;
  return  Math.atan2(-dy, dx);
}

export function wallVisible(wall1:BS.Wall, wall2:BS.Wall, ms:MoveStruct) {
  var dx1 = wall2.x - wall1.x;
  var dy1 = wall2.y - wall1.y;
  var dx2 = ms.x - wall1.x;
  var dy2 = ms.y - wall1.y;
  return (dx1*dy2 >= dy1*dx2);
}
