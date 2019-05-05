import {Board, Sector, Wall, Sprite} from './structs';
import * as U from './utils';
import * as MU from '../../../libs/mathutils';
import {ArtInfo, ArtInfoProvider} from './art';

const DELTA_DIST = Math.SQRT2;
const DELTA = 1e-6;
const DEFAULT_REPEAT_RATE = 128;

export function findSector(board:Board, wallId:number):number {
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

function pointOnWall(board:Board, wallId:number, x:number, y:number):number {
  var wall = board.walls[wallId];
  var wall2 = board.walls[wall.point2];
  var wx = wall2.x - wall.x;
  var wy = wall2.y - wall.y;
  var dx = x - wall.x;
  var dy = y - wall.y;
  return MU.dot2d(dx, dy, wx, wy) / MU.dot2d(wx, wy, wx, wy);
}

function distanceToWall(board:Board, wallId:number, x:number, y:number):number {
  var wall = board.walls[wallId];
  var wall2 = board.walls[wall.point2];
  var wx = wall2.x - wall.x;
  var wy = wall2.y - wall.y;
  var dx = x - wall.x;
  var dy = y - wall.y;
  var c1 = MU.dot2d(dx, dy, wx, wy);
  if (c1 <= 0)
    return MU.len2d(dx, dy);
  var c2 = MU.dot2d(wx, wy, wx, wy);
  if (c2 <= c1)
    return MU.len2d(x-wall2.x, y-wall2.y);
  var b = c1 / c2;
  var bx = wall.x + wx * b;
  var by = wall.y + wy * b;
  return MU.len2d(x-bx, y-by);
}

export function closestWall(board:Board, x:number, y:number, secId:number):number[] {
  secId = U.findSector(board, x, y, secId);
  if (secId != -1) {
    var start = board.sectors[secId].wallptr;
    var end = start + board.sectors[secId].wallnum;
    var wallId = start;
    var mindist = Number.MAX_VALUE;
    for (var w = start; w < end; w++) {
      var dist = distanceToWall(board, w, x, y);
      if (dist <= mindist) {
        mindist = dist;
        wallId = w;
      }
    }
    return [wallId, mindist];
  } else {
    var wallId = 0;
    var mindist = Number.MAX_VALUE;
    for (var w = 0; w < board.walls.length; w++) {
      var wall = board.walls[w];
      if (wall.nextwall != -1)
        continue;
      var dist = distanceToWall(board, w, x, y);
      if (dist <= mindist) {
        mindist = dist;
        wallId = w;
      }
    }
    return [wallId, mindist];
  }
}

function moveWalls(board:Board, secId:number, afterWallId:number, size:number, wallptrs:number[]) {
  for (var w = 0; w < board.walls.length; w++) {
    var wall = board.walls[w];
    if (wall.point2 > afterWallId)
      wall.point2 += size;
    if (wall.nextwall > afterWallId)
      wall.nextwall += size;
  }
  for (var w = 0; w < wallptrs.length; w++) {
    if (wallptrs[w] > afterWallId)
      wallptrs[w] += size;
  }
  var end = board.walls.length - 1;
  for (var i = end; i > afterWallId; i--) {
    board.walls[i+size] = board.walls[i];
  }
  for (var i = 0; i < size; i++) {
    board.walls[i+afterWallId+1] = null;
  }
  board.sectors[secId].wallnum += size;
  for (var i = 0; i < board.sectors.length; i++) {
    var sec = board.sectors[i];
    if (sec.wallptr > afterWallId)
      sec.wallptr += size;
  }
}

function walllen(board:Board, wallId:number) {
  var wall = board.walls[wallId];
  var wall2 = board.walls[wall.point2];
  var dx = wall2.x - wall.x;
  var dy = wall2.y - wall.y;
  return MU.len2d(dx, dy);
}

function fixxrepeat(board:Board, wallId:number, reprate:number=DEFAULT_REPEAT_RATE) {
  var wall = board.walls[wallId];
  wall.xrepeat = Math.min(255, Math.max(1, Math.round((walllen(board, wallId)+0.5) / reprate)))
}

function fixpoint2xpan(board:Board, wallId:number, art:ArtInfoProvider) {
  var wall = board.walls[wallId];
  var wall2 = board.walls[wall.point2];
  wall2.xpanning = ((wall.xpanning + (wall.xrepeat << 3)) % art.getInfo(wall.picnum).w) & 0xff;
}

function insertPoint(board:Board, wallId:number, x:number, y:number, art:ArtInfoProvider, wallptrs:number[]) {
  var secId = findSector(board, wallId);
  var wall = board.walls[wallId];
  var lenperrep = walllen(board, wallId) / Math.max(wall.xrepeat, 1);
  moveWalls(board, secId, wallId, 1, wallptrs);
  var nwall = copyWall(wall, x, y);
  board.walls[wallId+1] = nwall;
  wall.point2 = wallId+1;
  fixxrepeat(board, wallId, lenperrep);
  fixpoint2xpan(board, wallId, art);
  fixxrepeat(board, wallId+1, lenperrep);
}

function copyWall(wall:Wall, x:number, y:number):Wall {
  var nwall = new Wall();
  nwall.x = x;
  nwall.y = y;
  nwall.point2 = wall.point2;
  nwall.nextwall = wall.nextwall;
  nwall.nextsector = wall.nextsector;
  nwall.cstat = wall.cstat;
  nwall.picnum = wall.picnum;
  nwall.overpicnum = wall.overpicnum;
  nwall.shade = wall.shade;
  nwall.pal = wall.pal;
  nwall.xrepeat = wall.xrepeat;
  nwall.yrepeat = wall.yrepeat;
  nwall.xpanning = wall.xpanning;
  nwall.ypanning = wall.ypanning;
  nwall.lotag = wall.lotag;
  nwall.hitag = wall.hitag;
  nwall.extra = wall.extra;
  return nwall;
}

export function splitWall(board:Board, wallId:number, x:number, y:number, art:ArtInfoProvider, wallptrs:number[]):number {
  var wall = board.walls[wallId];
  if (MU.len2d(wall.x-x, wall.y-y) < DELTA_DIST)
    return wallId;
  var wall2 = board.walls[wall.point2];
  if (MU.len2d(wall2.x-x, wall2.y-y) < DELTA_DIST)
    return wallId;
  insertPoint(board, wallId, x, y, art, wallptrs);
  if (wall.nextwall != -1) {
    var nextwallId = wall.nextwall;
    insertPoint(board, nextwallId, x, y, art, wallptrs);
    var wallId = board.walls[nextwallId].nextwall;
    board.walls[wallId].nextwall = nextwallId+1; 
    board.walls[wallId+1].nextwall = nextwallId; 
    board.walls[nextwallId].nextwall = wallId+1; 
    board.walls[nextwallId+1].nextwall = wallId; 
    return wallId;
  }
  return wallId;
}

export function lastwall(board:Board, wallId:number):number {
  if (wallId > 0 && board.walls[wallId-1].point2 == wallId)
    return wallId-1;
  for(var w = wallId;; w = board.walls[w].point2) {
    if (board.walls[w].point2 == wallId)
      return w;
  }
  return wallId;
}

function doMoveWall(board:Board, w:number, x:number, y:number) {
  var walls = board.walls;
  var p = lastwall(board, w);
  walls[w].x = x;
  walls[w].y = y;
  fixxrepeat(board, w);
  fixxrepeat(board, p);
}

export function moveWall(board:Board, wallId:number, x:number, y:number) {
  var walls = board.walls;
  var w = wallId;
  doMoveWall(board, w, x, y);
  do {
    if (walls[w].nextwall != -1) {
      w = walls[walls[w].nextwall].point2;
      doMoveWall(board, w, x, y);
    } else {
      w = wallId;
      do {
        var prevwall = lastwall(board, w);
        if (walls[prevwall].nextwall != -1) {
          w = walls[prevwall].nextwall;
          doMoveWall(board, w, x, y);
        } else {
          break;
        }
      } while (w != wallId)
    }
  } while (w != wallId);
}

export function pushWall(board:Board, wallId:number, len:number, art:ArtInfoProvider, wallptrs:number[]) {
  var w1 = wallId; var wall1 = board.walls[w1];
  var w2 = wall1.point2; var wall2 = board.walls[w2];
  var p1 = lastwall(board, w1); var prev1 = board.walls[p1];
  var n2 = wall2.point2; var next2 = board.walls[n2];
  var dx = wall2.x - wall1.x; var dy = wall2.y - wall1.y;
  var l = Math.sqrt(dx*dx + dy*dy);
  dx = MU.int(dx/l * len); dy = MU.int(dy/l * len);
  var x1 = wall1.x-dy; var y1 = wall1.y+dx;
  var x2 = wall2.x-dy; var y2 = wall2.y+dx;
  var extent1 = MU.cross2d(x1 - prev1.x, y1 - prev1.y, wall1.x - prev1.x, wall1.y - prev1.y) == 0;
  var extent2 = MU.cross2d(x2 - next2.x, y2 - next2.y, wall2.x - next2.x, wall2.y - next2.y) == 0;

  if (extent1 && extent2) {
    moveWall(board, w1, x1, y1);
    moveWall(board, w2, x2, y2);
    return w1;
  } else if (extent1 && !extent2) {
    moveWall(board, w1, x1, y1);
    splitWall(board, w1, x2, y2, art, wallptrs);
    return w1;
  } else if (!extent1 && extent2) {
    w1 = splitWall(board, w1, x1, y1, art, wallptrs);
    w2 = board.walls[board.walls[w1].point2].point2;
    moveWall(board, w2, x2, y2);
    return w1;
  } else if (!extent1 && !extent2) {
    w1 = splitWall(board, w1, x1, y1, art, wallptrs);
    w2 = board.walls[w1].point2;
    splitWall(board, w2, x2, y2, art, wallptrs);
    return w2;
  }
}

