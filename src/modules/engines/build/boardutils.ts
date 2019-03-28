import {Board, Sector, Wall, Sprite} from './structs';
import * as U from './utils';
import * as MU from '../../../libs/mathutils';

const DELTA = 1e-6;

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

function reserveWallPlace(board:Board, secId:number, afterWallId:number, size:number) {
  for (var w = 0; w < board.walls.length; w++) {
    var wall = board.walls[w];
    if (wall.point2 > afterWallId)
      wall.point2 += size;
    if (wall.nextwall > afterWallId)
      wall.nextwall += size;
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

export function insertWall(board:Board, secId:number, afterWallId:number, wall:Wall, wall2:Wall=null):number {
  var afterWall = board.walls[afterWallId];
  if (afterWall.nextsector != -1 && wall2 == null)
    return -1;

  reserveWallPlace(board, secId, afterWallId, 1);
  wall.point2 = afterWall.point2;
  afterWall.point2 = afterWallId + 1;
  board.walls[afterWallId + 1] = wall;

  if (afterWall.nextsector == -1)
    return 0;

  var nextsectorId = afterWall.nextsector;
  var nextwallId = afterWall.nextwall;
  var nextwall = board.walls[nextwallId];
  reserveWallPlace(board, nextsectorId, nextwallId, 1);
  wall2.point2 = nextwall.point2;
  nextwall.point2 = nextwallId + 1;
  board.walls[nextwallId + 1] = nextwall;

  wall.nextwall = nextwallId + 1;
  nextwall.nextwall = afterWallId + 1;

  return 0;
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

function splittedWall(wall:Wall, x:number, y:number):Wall {
  var nwall = new Wall();
  nwall.x = x;
  nwall.y = y;
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

export function splitWall(board:Board, wallId:number, x:number, y:number, secId:number):number {
	var [w, d] = closestWall(board, x, y, secId);
  if (d > DELTA)
    return -1;
  var t = pointOnWall(board, w, x, y);
  if (t < DELTA) return w;
  if (t + DELTA > 1) return board.walls[w].point2;

  var wall = board.walls[w];
  secId = findSector(board, w);
  var nwall = splittedWall(wall, x, y);
  var nextnwall = null;
  if (wall.nextwall != -1) {
    var nextwall = board.walls[wall.nextwall];
    nextnwall = splittedWall(nextwall, x, y);
  }
  insertWall(board, secId, w, nwall, nextnwall);
  return 0;
}

