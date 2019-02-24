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


class SectorIntersect {
  constructor(
    public t:number,
    public wall:BS.Wall,
    public point:number[]
  ) {}
}