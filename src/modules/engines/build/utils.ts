import BS = require('./structs');
import MU = require('../../../libs/mathutils');

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

export function findSector(board:BS.Board, x:number, y:number, secnum:number = 0):number {
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

export function getSprites(board:BS.Board, secnum:number):number[] {
  var ret = [];
  var sprites = board.sprites;
  for (var i = 0; i < sprites.length; i++) {
    if (sprites[i].sectnum == secnum)
      ret.push(i);
  }
  return ret;
}