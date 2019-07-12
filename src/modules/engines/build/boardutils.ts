import * as MU from '../../../libs/mathutils';
import { ArtInfoProvider } from './art';
import { Board, Wall } from './structs';
import * as U from './utils';
import { IndexedDeck, Deck } from '../../deck';

const DELTA_DIST = Math.SQRT2;
export const DEFAULT_REPEAT_RATE = 128;

export function pointOnWall(board: Board, wallId: number, x: number, y: number): number {
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
    for (let w = 0; w < board.numwalls; w++) {
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

function deleteSectorImpl(board: Board, sectorId: number) {
  if (board.sectors[sectorId].wallnum != 0)
    throw new Error('Error while deleting sector #' + sectorId + '. wallnum != 0');

  for (let w = 0; w < board.numwalls; w++) {
    let wall = board.walls[w];
    if (wall.nextsector == sectorId)
      throw new Error('Error while deleting sector #' + sectorId + '. Wall #' + w + ' referensing sector');
    if (wall.nextsector > sectorId)
      wall.nextsector--;
  }
  for (let s = 0; s < board.numsprites; s++) {
    let spr = board.sprites[s];
    if (spr.sectnum == sectorId)
      throw new Error('Error while deleting sector #' + sectorId + '. Sprite #' + s + ' referensing sector');
    if (spr.sectnum > sectorId)
      spr.sectnum--;
  }
  for (let s = sectorId; s < board.numsectors - 1; s++) {
    board.sectors[s] = board.sectors[s + 1];
  }
  board.sectors[board.numsectors - 1] = null;
  board.numsectors--;
}

function moveWalls(board: Board, secId: number, afterWallId: number, size: number, wallptrs: number[]) {
  for (let w = 0; w < board.numwalls; w++) {
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
  if (size > 0) {
    let end = board.numwalls - 1;
    for (let i = end; i > afterWallId; i--) {
      board.walls[i + size] = board.walls[i];
    }
    for (let i = 0; i < size; i++) {
      board.walls[i + afterWallId + 1] = null;
    }
  } else {
    let end = board.numwalls + size;
    for (let i = afterWallId; i < end; i++) {
      board.walls[i] = board.walls[i - size];
    }
    for (let i = 0; i < -size; i++) {
      board.walls[end + i] = null;
    }
  }
  board.numwalls += size;
  board.sectors[secId].wallnum += size;
  for (let i = 0; i < board.numsectors; i++) {
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

export function connectedWalls(board: Board, wallId: number, result: Deck<number>): Deck<number> {
  let walls = board.walls;
  result.push(wallId);
  let w = wallId;
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

let wallsToMove = new Deck<number>();
export function moveWall(board: Board, wallId: number, x: number, y: number): boolean {
  let walls = board.walls;
  let wall = walls[wallId];
  if (wall.x == x && wall.y == y) return false;
  connectedWalls(board, wallId, wallsToMove.clear());
  for (let i = 0; i < wallsToMove.length(); i++) {
    doMoveWall(board, wallsToMove.get(i), x, y);
  }
  return true;
}

export function moveSprite(board: Board, sprId: number, x: number, y: number, z: number): boolean {
  var spr = board.sprites[sprId];
  if (spr.x == x && spr.y == y && spr.z == z) return false;
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

export function packWallSectorId(wallId: number, sectorId: number) {
  return wallId | (sectorId << 16)
}

export function unpackWallId(wallSectorId: number) {
  return wallSectorId & 0xffff;
}

export function unpackSectorId(wallSectorId: number) {
  return (wallSectorId >> 16) & 0xffff;
}

export function isJoinedSectors(board: Board, s1: number, s2: number) {
  let sec1 = board.sectors[s1];
  let end = sec1.wallptr + sec1.wallnum;
  for (let w = sec1.wallptr; w < end; w++) {
    let wall = board.walls[w];
    if (wall.nextsector == s2)
      return w;
  }
  return -1;
}

function fillSectorWalls(board: Board, s: number, set: Set<number>) {
  let sec = board.sectors[s];
  let end = sec.wallptr + sec.wallnum;
  for (let w = sec.wallptr; w < end; w++)
    set.add(w);
}

let wallset = new Set<number>();
function fillWallSet(board: Board, s1: number, s2: number) {
  wallset.clear();
  fillSectorWalls(board, s1, wallset);
  fillSectorWalls(board, s2, wallset);
  return wallset;
}

function moveSpritesToSector(board: Board, fromSector: number, toSector: number) {
  let sprites = U.groupSprites(board)[fromSector];
  if (sprites == undefined)
    return
  for (let i = 0; i < sprites.length; i++) {
    board.sprites[sprites[i]].sectnum = toSector;
  }
}

let newsectorwalls = new Deck<Wall>();
let loopPoints = new Deck<number>();
function getJoinedWallsLoops(board: Board, s1: number, s2: number): [Deck<Wall>, Deck<number>] {
  newsectorwalls.clear();
  loopPoints.clear();
  let wallset = fillWallSet(board, s1, s2);
  let values = wallset.values();
  for (let it = values.next(); !it.done; it = values.next()) {
    let w = it.value;
    let loopstart = w;
    for (; ;) {
      let wall = board.walls[w];
      wallset.delete(w);
      if (wall.nextsector == s1 || wall.nextsector == s2) {
        wallset.delete(wall.nextwall);
        w = board.walls[wall.nextwall].point2;
      } else {
        newsectorwalls.push(wall);
        w = wall.point2;
      }
      if (w == loopstart) {
        let ll = loopPoints.length();
        let nl = newsectorwalls.length();
        if (ll == 0 && nl != 0 || ll != 0 && loopPoints.get(ll - 1) != nl)
          loopPoints.push(nl);
        break;
      }
    }
  }
  return [newsectorwalls, loopPoints];
}

function insertWallsToSector(board: Board, sectorId: number, nwalls: Deck<Wall>, looppoints: Deck<number>) {
  let sec = board.sectors[sectorId];
  let loopptr = 0;
  let loopidx = looppoints.get(loopptr++);
  for (let i = 0; i < nwalls.length(); i++) {
    let w = sec.wallptr + i;
    let wall = nwalls.get(i);
    board.walls[w] = wall;
    if (loopidx == i + 1) {
      wall.point2 = w + 1 - loopidx;
      loopidx = looppoints.get(loopptr++);
    } else {
      wall.point2 = w + 1;
    }
    if (wall.nextwall != -1) {
      let nextwall = board.walls[wall.nextwall];
      nextwall.nextsector = sectorId;
      nextwall.nextwall = w;
    }
  }
}

export function joinSectors(board: Board, s1: number, s2: number) {
  if (isJoinedSectors(board, s1, s2) == -1) return -1;
  let [nwalls, looppoints] = getJoinedWallsLoops(board, s1, s2);
  let sec2 = board.sectors[s2], sec1 = board.sectors[s1];
  moveWalls(board, s2, sec2.wallptr, -sec2.wallnum, []);
  moveWalls(board, s1, sec1.wallptr, nwalls.length() - sec1.wallnum, []);
  insertWallsToSector(board, s1, nwalls, looppoints);
  moveSpritesToSector(board, s2, s1);
  deleteSectorImpl(board, s2);
  return 0;
}

export function deleteSector(board: Board, sectorId: number) {

}