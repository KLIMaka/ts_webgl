import * as MU from '../../../libs/mathutils';
import { ArtInfoProvider } from './art';
import { Board, Wall } from './structs';
import * as U from './utils';
import { NumberVector } from '../../vector';

const DELTA_DIST = Math.SQRT2;
export const DEFAULT_REPEAT_RATE = 128;

function pointOnWall(board: Board, wallId: number, x: number, y: number): number {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  let wx = wall2.x - wall.x;
  let wy = wall2.y - wall.y;
  let dx = x - wall.x;
  let dy = y - wall.y;
  return MU.dot2d(dx, dy, wx, wy) / MU.dot2d(wx, wy, wx, wy);
}

function distanceToWall(board: Board, wallId: number, x: number, y: number): number {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  let wx = wall2.x - wall.x;
  let wy = wall2.y - wall.y;
  let dx = x - wall.x;
  let dy = y - wall.y;
  let c1 = MU.dot2d(dx, dy, wx, wy);
  if (c1 <= 0)
    return MU.len2d(dx, dy);
  let c2 = MU.dot2d(wx, wy, wx, wy);
  if (c2 <= c1)
    return MU.len2d(x - wall2.x, y - wall2.y);
  let b = c1 / c2;
  let bx = wall.x + wx * b;
  let by = wall.y + wy * b;
  return MU.len2d(x - bx, y - by);
}

export function closestWallOnWall(board: Board, w1: number, x: number, y: number): number {
  let wall1 = board.walls[w1];
  let w2 = wall1.point2;
  let wall2 = board.walls[w2];
  let dist1 = MU.len2d(wall1.x - x, wall1.y - y);
  let dist2 = MU.len2d(wall2.x - x, wall2.y - y);
  return dist2 > dist1 ? w1 : w2;
}

export function closestWallInSector(board: Board, secId: number, x: number, y: number, d: number): number {
  let sec = board.sectors[secId];
  if (sec == undefined)
    return -1;
  let start = sec.wallptr;
  let end = sec.wallptr + sec.wallnum;
  let mindist = Number.MAX_VALUE;
  let result = -1;
  for (let w = start; w < end; w++) {
    let wall = board.walls[w];
    let dist = MU.len2d(wall.x - x, wall.y - y);
    if (dist < d && dist < mindist) {
      mindist = dist;
      result = w;
    }
  }
  return result;
}

export function closestWall(board: Board, x: number, y: number, secId: number): number[] {
  secId = U.findSector(board, x, y, secId);
  let mindist = Number.MAX_VALUE;
  if (secId != -1) {
    let start = board.sectors[secId].wallptr;
    let end = start + board.sectors[secId].wallnum;
    let wallId = start;
    for (let w = start; w < end; w++) {
      let dist = distanceToWall(board, w, x, y);
      if (dist <= mindist) {
        mindist = dist;
        wallId = w;
      }
    }
    return [wallId, mindist];
  } else {
    let wallId = 0;
    for (let w = 0; w < board.walls.length; w++) {
      let wall = board.walls[w];
      if (wall.nextwall != -1)
        continue;
      let dist = distanceToWall(board, w, x, y);
      if (dist <= mindist) {
        mindist = dist;
        wallId = w;
      }
    }
    return [wallId, mindist];
  }
}

function moveWalls(board: Board, secId: number, afterWallId: number, size: number, wallptrs: number[]) {
  for (let w = 0; w < board.walls.length; w++) {
    let wall = board.walls[w];
    if (wall.point2 > afterWallId)
      wall.point2 += size;
    if (wall.nextwall > afterWallId)
      wall.nextwall += size;
  }
  for (let w = 0; w < wallptrs.length; w++) {
    if (wallptrs[w] > afterWallId)
      wallptrs[w] += size;
  }
  let end = board.walls.length - 1;
  for (let i = end; i > afterWallId; i--) {
    board.walls[i + size] = board.walls[i];
  }
  for (let i = 0; i < size; i++) {
    board.walls[i + afterWallId + 1] = null;
  }
  board.sectors[secId].wallnum += size;
  for (let i = 0; i < board.sectors.length; i++) {
    let sec = board.sectors[i];
    if (sec.wallptr > afterWallId)
      sec.wallptr += size;
  }
}

export function walllen(board: Board, wallId: number) {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  let dx = wall2.x - wall.x;
  let dy = wall2.y - wall.y;
  return MU.len2d(dx, dy);
}

function fixxrepeat(board: Board, wallId: number, reprate: number = DEFAULT_REPEAT_RATE) {
  let wall = board.walls[wallId];
  wall.xrepeat = Math.min(255, Math.max(1, Math.round((walllen(board, wallId) + 0.5) / reprate)))
}

function fixpoint2xpan(board: Board, wallId: number, art: ArtInfoProvider) {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  wall2.xpanning = ((wall.xpanning + (wall.xrepeat << 3)) % art.getInfo(wall.picnum).w) & 0xff;
}

function insertPoint(board: Board, wallId: number, x: number, y: number, art: ArtInfoProvider, wallptrs: number[]) {
  let secId = U.sectorOfWall(board, wallId);
  let wall = board.walls[wallId];
  let lenperrep = walllen(board, wallId) / Math.max(wall.xrepeat, 1);
  moveWalls(board, secId, wallId, 1, wallptrs);
  let nwall = copyWall(wall, x, y);
  board.walls[wallId + 1] = nwall;
  wall.point2 = wallId + 1;
  fixxrepeat(board, wallId, lenperrep);
  fixpoint2xpan(board, wallId, art);
  fixxrepeat(board, wallId + 1, lenperrep);
}

function copyWall(wall: Wall, x: number, y: number): Wall {
  let nwall = new Wall();
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

export function splitWall(board: Board, wallId: number, x: number, y: number, art: ArtInfoProvider, wallptrs: number[]): number {
  let wall = board.walls[wallId];
  if (MU.len2d(wall.x - x, wall.y - y) < DELTA_DIST)
    return wallId;
  let wall2 = board.walls[wall.point2];
  if (MU.len2d(wall2.x - x, wall2.y - y) < DELTA_DIST)
    return wallId;
  insertPoint(board, wallId, x, y, art, wallptrs);
  if (wall.nextwall != -1) {
    let nextwallId = wall.nextwall;
    insertPoint(board, nextwallId, x, y, art, wallptrs);
    let wallId = board.walls[nextwallId].nextwall;
    board.walls[wallId].nextwall = nextwallId + 1;
    board.walls[wallId + 1].nextwall = nextwallId;
    board.walls[nextwallId].nextwall = wallId + 1;
    board.walls[nextwallId + 1].nextwall = wallId;
    return wallId;
  }
  return wallId;
}

export function prevwall(board: Board, wallId: number): number {
  if (wallId > 0 && board.walls[wallId - 1].point2 == wallId)
    return wallId - 1;
  for (let w = wallId; ; w = board.walls[w].point2) {
    if (board.walls[w].point2 == wallId)
      return w;
  }
}

export function nextwall(board: Board, wallId: number): number {
  return board.walls[wallId].point2;
}

function doMoveWall(board: Board, w: number, x: number, y: number) {
  board.walls[w].x = x;
  board.walls[w].y = y;
  fixxrepeat(board, w);
  fixxrepeat(board, prevwall(board, w));
}

export function connectedWalls(board: Board, wallId: number, result: NumberVector): NumberVector {
  let walls = board.walls;
  result.push(wallId);
  let w = wallId;
  result.push(w);
  do {
    if (walls[w].nextwall != -1) {
      w = walls[walls[w].nextwall].point2;
      result.push(w);
    } else {
      w = wallId;
      do {
        let p = prevwall(board, w);
        if (walls[p].nextwall != -1) {
          w = walls[p].nextwall;
          result.push(w);
        } else {
          break;
        }
      } while (w != wallId)
    }
  } while (w != wallId)
  return result;
}

let wallsToMove = new NumberVector();
export function moveWall(board: Board, wallId: number, x: number, y: number): boolean {
  let walls = board.walls;
  let wall = walls[wallId];
  if (wall.x == x && wall.y == y)
    return false;
  connectedWalls(board, wallId, wallsToMove.clear());
  for (let i = 0; i < wallsToMove.length(); i++) {
    doMoveWall(board, wallsToMove.get(i), x, y);
  }
  return true;
}

export function moveSprite(board: Board, sprId: number, x: number, y: number, z:number): boolean {
  var spr = board.sprites[sprId];
  if (spr.x == x && spr.y == y && spr.z == z)
    return false;
  spr.x = x;
  spr.y = y;
  spr.z = z;
  spr.sectnum = U.findSector(board, x, y, spr.sectnum);
  return true;
}


// export function pushWall(board: Board, wallId: number, len: number, art: ArtInfoProvider, wallptrs: number[]) {
//   let w1 = wallId; let wall1 = board.walls[w1];
//   let w2 = wall1.point2; let wall2 = board.walls[w2];
//   let p1 = prevwall(board, w1); let prev1 = board.walls[p1];
//   let n2 = wall2.point2; let next2 = board.walls[n2];
//   let dx = wall2.x - wall1.x; let dy = wall2.y - wall1.y;
//   let l = MU.len2d(dx, dy);
//   dx = MU.int(dx / l * len); dy = MU.int(dy / l * len);
//   let x1 = wall1.x - dy; let y1 = wall1.y + dx;
//   let x2 = wall2.x - dy; let y2 = wall2.y + dx;
//   let extent1 = MU.cross2d(x1 - prev1.x, y1 - prev1.y, wall1.x - prev1.x, wall1.y - prev1.y) == 0;
//   let extent2 = MU.cross2d(x2 - next2.x, y2 - next2.y, wall2.x - next2.x, wall2.y - next2.y) == 0;

//   if (extent1 && extent2) {
//     moveWall(board, w1, x1, y1);
//     moveWall(board, w2, x2, y2);
//     return w1;
//   } else if (extent1 && !extent2) {
//     moveWall(board, w1, x1, y1);
//     return splitWall(board, w1, x2, y2, art, wallptrs);
//   } else if (!extent1 && extent2) {
//     w1 = splitWall(board, w1, x1, y1, art, wallptrs);
//     w2 = nextwall(board, nextwall(board, w1));
//     moveWall(board, w2, x2, y2);
//     return nextwall(board, w1);
//   } else if (!extent1 && !extent2) {
//     w1 = splitWall(board, w1, x1, y1, art, wallptrs);
//     w2 = board.walls[w1].point2;
//     return splitWall(board, w2, x2, y2, art, wallptrs);
//   }
// }

