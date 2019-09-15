import * as MU from '../../../libs/mathutils';
import { cross2d, cyclic, reverse } from '../../../libs/mathutils';
import { Collection, Deck, findFirst, reversed } from '../../deck';
import { ArtInfoProvider } from './art';
import { Board, Sector, SectorStats, Wall, WallStats, Sprite, SpriteStats, FACE } from './structs';
import { findSector, sectorOfWall } from './utils';
import { Type } from './gl/renderable';

const DELTA_DIST = Math.SQRT2;
export const DEFAULT_REPEAT_RATE = 128;

let loop = new Deck<number>();
export function loopWalls(board: Board, wallId: number, sectorId: number) {
  let sec = board.sectors[sectorId];
  loop.clear();
  let loopFound = false;
  for (let w = sec.wallptr; w < sec.wallnum + sec.wallptr; w++) {
    loop.push(w);
    if (w == wallId) loopFound = true;
    let wall = board.walls[w];
    if (w > wall.point2) {
      if (loopFound) return loop;
      loop.clear();
    }
  }
  return null;
}

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
  let end = sec.wallptr + sec.wallnum;
  let mindist = Number.MAX_VALUE;
  let result = -1;
  for (let w = sec.wallptr; w < end; w++) {
    let wall = board.walls[w];
    let dist = MU.len2d(wall.x - x, wall.y - y);
    if (dist < d && dist < mindist) {
      mindist = dist;
      result = w;
    }
  }
  return result;
}

export function wallInSector(board: Board, secId: number, x: number, y: number) {
  let sec = board.sectors[secId];
  let end = sec.wallptr + sec.wallnum;
  for (let w = sec.wallptr; w < end; w++) {
    let wall = board.walls[w];
    if (wall.x == x && wall.y == y) return w;
  }
  return -1;
}

export function closestWall(board: Board, x: number, y: number, secId: number): number[] {
  secId = findSector(board, x, y, secId);
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

function addSector(board: Board, sector: Sector) {
  let idx = board.numsectors;
  board.sectors[idx] = sector;
  sector.wallptr = board.numwalls;
  board.numsectors++;
  return idx;
}

function moveWalls(board: Board, secId: number, afterWallId: number, size: number, wallptrs: number[]) {
  if (size == 0) return;
  for (let w = 0; w < board.numwalls; w++) {
    let wall = board.walls[w];
    if (wall.point2 > afterWallId)
      wall.point2 += size;
    if (wall.nextwall > afterWallId)
      wall.nextwall += size;
  }
  for (let w = 0; w < wallptrs.length; w++) {
    if (size < 0 && wallptrs[w] >= afterWallId && wallptrs[w] < afterWallId - size) {
      wallptrs[w] = -1;
    } else if (wallptrs[w] > 0 && wallptrs[w] > afterWallId) {
      wallptrs[w] += size;
    }
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
    if (sec.wallptr >= afterWallId + 1 && i != secId)
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

function insertWall(board: Board, wallId: number, x: number, y: number, art: ArtInfoProvider, wallptrs: number[]) {
  let secId = sectorOfWall(board, wallId);
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

function insertSector(board: Board, sector: Sector) {
  board.sectors[board.numsectors++] = sector;
}

function copyWallStats(stat: WallStats): WallStats {
  let nstat = new WallStats();
  nstat.alignBottom = stat.alignBottom;
  nstat.blocking = stat.blocking;
  nstat.blocking2 = stat.blocking2;
  nstat.masking = stat.masking;
  nstat.oneWay = stat.oneWay;
  nstat.swapBottoms = stat.swapBottoms;
  nstat.translucent = stat.translucent;
  nstat.translucentReversed = stat.translucentReversed;
  nstat.xflip = stat.xflip;
  nstat.yflip = stat.yflip;
  return nstat;
}

function copyWall(wall: Wall, x: number, y: number): Wall {
  let nwall = new Wall();
  nwall.x = x;
  nwall.y = y;
  nwall.point2 = wall.point2;
  nwall.nextwall = wall.nextwall;
  nwall.nextsector = wall.nextsector;
  nwall.cstat = copyWallStats(wall.cstat);
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

function newWallStats() {
  let stat = new WallStats();
  stat.alignBottom = 0;
  stat.blocking = 0;
  stat.blocking2 = 0;
  stat.masking = 0;
  stat.oneWay = 0;
  stat.swapBottoms = 0;
  stat.translucent = 0;
  stat.translucentReversed = 0;
  stat.xflip = 0;
  stat.yflip = 0;
  return stat;
}

function newWall(x: number, y: number): Wall {
  let wall = new Wall();
  wall.x = x;
  wall.y = y;
  wall.point2 = -1;
  wall.nextwall = -1;
  wall.nextsector = -1;
  wall.cstat = newWallStats();
  wall.picnum = 0;
  wall.overpicnum = 0;
  wall.shade = 0;
  wall.pal = 0;
  wall.xrepeat = 8;
  wall.yrepeat = 8;
  wall.xpanning = 0;
  wall.ypanning = 0;
  wall.lotag = 0;
  wall.hitag = 0
  wall.extra = -1;
  return wall;
}

function copySectorStats(stat: SectorStats): SectorStats {
  let nstat = new SectorStats();
  nstat.alignToFirstWall = stat.alignToFirstWall;
  nstat.doubleSmooshiness = stat.doubleSmooshiness;
  nstat.parallaxing = stat.parallaxing;
  nstat.slopped = stat.slopped;
  nstat.swapXY = stat.swapXY;
  nstat.xflip = stat.xflip;
  nstat.yflip = stat.yflip;
  return nstat;
}

function copySector(sector: Sector): Sector {
  let nsector = new Sector();
  nsector.ceilingheinum = sector.ceilingheinum;
  nsector.ceilingpal = sector.ceilingpal;
  nsector.ceilingpicnum = sector.ceilingpicnum;
  nsector.ceilingshade = sector.ceilingshade;
  nsector.ceilingstat = copySectorStats(sector.ceilingstat);
  nsector.ceilingxpanning = sector.ceilingxpanning;
  nsector.ceilingypanning = sector.ceilingypanning;
  nsector.ceilingz = sector.ceilingz;
  nsector.extra = sector.extra;
  nsector.floorheinum = sector.floorheinum;
  nsector.floorpal = sector.floorpal;
  nsector.floorpicnum = sector.floorpicnum;
  nsector.floorshade = sector.floorshade;
  nsector.floorstat = copySectorStats(sector.floorstat);
  nsector.floorxpanning = sector.floorxpanning;
  nsector.floorypanning = sector.floorypanning;
  nsector.floorz = sector.floorz;
  nsector.hitag = sector.hitag;
  nsector.lotag = sector.lotag;
  nsector.visibility = sector.visibility;
  nsector.wallnum = 0;
  nsector.wallptr = 0;
  return nsector;
}

function newSectorStats() {
  let stat = new SectorStats();
  stat.alignToFirstWall = 0;
  stat.doubleSmooshiness = 0;
  stat.parallaxing = 0;
  stat.slopped = 0;
  stat.swapXY = 0;
  stat.xflip = 0;
  stat.yflip = 0;
  return stat;
}

function newSector(): Sector {
  let sector = new Sector();
  sector.ceilingheinum = 0;
  sector.ceilingpal = 0;
  sector.ceilingpicnum = 0;
  sector.ceilingshade = 0;
  sector.ceilingstat = newSectorStats();
  sector.ceilingxpanning = 0;
  sector.ceilingypanning = 0;
  sector.ceilingz = -(32 << 8);
  sector.extra = -1;
  sector.floorheinum = 0;
  sector.floorpal = 0;
  sector.floorpicnum = 0;
  sector.floorshade = 0;
  sector.floorstat = newSectorStats();
  sector.floorxpanning = 0;
  sector.floorypanning = 0;
  sector.floorz = (32 << 8);
  sector.hitag = 0;
  sector.lotag = 0;
  sector.visibility = 0;
  sector.wallnum = 0;
  sector.wallptr = 0;
  return sector;
}

function newSpriteStats() {
  let stats = new SpriteStats();
  stats.blocking = 0;
  stats.blocking2 = 0;
  stats.invisible = 0;
  stats.noautoshading = 0;
  stats.onesided = 0;
  stats.realCenter = 0;
  stats.tranclucentReversed = 0;
  stats.translucent = 0;
  stats.type = FACE;
  stats.xflip = 0;
  stats.yflip = 0;
  return stats;
}

function newSprite(sectorId: number, x: number, y: number, z: number): Sprite {
  let sprite = new Sprite();
  sprite.ang = 0;
  sprite.clipdist = 0;
  sprite.cstat = newSpriteStats();
  sprite.extra = -1;
  sprite.hitag = 0;
  sprite.lotag = 0;
  sprite.owner = -1;
  sprite.pal = 0;
  sprite.picnum = 1;
  sprite.sectnum = sectorId;
  sprite.shade = 0;
  sprite.statnum = 0;
  sprite.x = x;
  sprite.y = y;
  sprite.z = z;
  sprite.xoffset = 0;
  sprite.yoffset = 0;
  sprite.xvel = 0;
  sprite.yvel = 0;
  sprite.xrepeat = 32;
  sprite.yrepeat = 32;
  return sprite;
}

export function splitWall(board: Board, wallId: number, x: number, y: number, art: ArtInfoProvider, wallptrs: number[]): number {
  let wall = board.walls[wallId];
  if (MU.len2d(wall.x - x, wall.y - y) < DELTA_DIST)
    return wallId;
  let wall2 = board.walls[wall.point2];
  if (MU.len2d(wall2.x - x, wall2.y - y) < DELTA_DIST)
    return wallId;
  insertWall(board, wallId, x, y, art, wallptrs);
  if (wall.nextwall != -1) {
    let nextwallId = wall.nextwall;
    insertWall(board, nextwallId, x, y, art, wallptrs);
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
    let wall = walls[w];
    if (wall.nextwall != -1) {
      w = nextwall(board, wall.nextwall);
      result.push(w);
    } else {
      w = wallId;
      do {
        let p = prevwall(board, w);
        let wall = walls[p];
        if (wall.nextwall != -1) {
          w = wall.nextwall;
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
  spr.x = x; spr.y = y; spr.z = z;
  spr.sectnum = findSector(board, x, y, spr.sectnum);
  return true;
}


export function pushWall(board: Board, wallId: number, len: number, art: ArtInfoProvider, wallptrs: number[]): number {
  if (len == 0) return wallId;
  let w1 = wallId; let wall1 = board.walls[w1];
  let w2 = wall1.point2; let wall2 = board.walls[w2];
  let p1 = prevwall(board, w1); let prev1 = board.walls[p1];
  let n2 = wall2.point2; let next2 = board.walls[n2];
  let dx = wall2.x - wall1.x; let dy = wall2.y - wall1.y;
  let l = MU.len2d(dx, dy) * len;
  dx = MU.int(dx / l); dy = MU.int(dy / l);
  let x1 = wall1.x - dy; let y1 = wall1.y + dx;
  let x2 = wall2.x - dy; let y2 = wall2.y + dx;
  let extent1 = MU.cross2d(x1 - prev1.x, y1 - prev1.y, wall1.x - prev1.x, wall1.y - prev1.y) == 0;
  let extent2 = MU.cross2d(x2 - next2.x, y2 - next2.y, wall2.x - next2.x, wall2.y - next2.y) == 0;

  if (extent1 && extent2) {
    moveWall(board, w1, x1, y1);
    moveWall(board, w2, x2, y2);
    return w1;
  } else if (extent1 && !extent2) {
    moveWall(board, w1, x1, y1);
    return splitWall(board, w1, x2, y2, art, wallptrs);
  } else if (!extent1 && extent2) {
    w1 = splitWall(board, w1, x1, y1, art, wallptrs);
    w2 = nextwall(board, nextwall(board, w1));
    moveWall(board, w2, x2, y2);
    return nextwall(board, w1);
  } else if (!extent1 && !extent2) {
    w1 = splitWall(board, w1, x1, y1, art, wallptrs);
    w2 = nextwall(board, w1);
    return splitWall(board, w2, x2, y2, art, wallptrs);
  }
}

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

function updateSpriteSector(board: Board, fromSector: number) {
  for (let s = 0; s < board.numsprites; s++) {
    let spr = board.sprites[s];
    if (spr.sectnum == fromSector)
      spr.sectnum = findSector(board, spr.x, spr.y, spr.sectnum);
  }
}

let newsectorwalls = new Deck<Wall>();
let loopPoints = new Deck<number>();
function getJoinedWallsLoops(board: Board, s1: number, s2: number): [Collection<Wall>, Collection<number>] {
  newsectorwalls.clear(); loopPoints.clear();
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

function recreateSectorWalls(board: Board, sectorId: number, nwalls: Collection<Wall>, looppoints: Collection<number>) {
  resizeWalls(board, sectorId, nwalls.length());
  let sec = board.sectors[sectorId];
  let loopId = 0;
  let loopStart = sec.wallptr;
  let loopEnd = looppoints.get(loopId++);
  for (let i = 0; i < nwalls.length(); i++) {
    let w = sec.wallptr + i;
    let wall = nwalls.get(i);
    board.walls[w] = wall;
    if (loopEnd == i + 1) {
      wall.point2 = loopStart;
      loopStart = w + 1;
      loopEnd = looppoints.get(loopId++);
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

let nullWall = new Wall();
function resizeWalls(board: Board, sectorId: number, newSize: number) {
  let sec = board.sectors[sectorId];
  let dw = newSize - sec.wallnum;
  if (dw > 0) {
    moveWalls(board, sectorId, sec.wallptr + sec.wallnum - 1, dw, []);
  } else {
    let from = sec.wallptr + newSize;
    let end = from - dw;
    for (let w = from; w < end; w++)
      board.walls[w] = nullWall;
    moveWalls(board, sectorId, sec.wallptr + newSize, dw, [])
  }
}

export function joinSectors(board: Board, s1: number, s2: number) {
  if (isJoinedSectors(board, s1, s2) == -1) return -1;
  let [nwalls, looppoints] = getJoinedWallsLoops(board, s1, s2);
  recreateSectorWalls(board, s1, nwalls, looppoints);
  updateSpriteSector(board, s2);
  resizeWalls(board, s2, 0);
  deleteSectorImpl(board, s2);
  return 0;
}

export function pushWallToSector(board: Board, wallId: number) {
  let wall = board.walls[wallId];
  let s = sectorOfWall(board, wallId);
  let sec = board.sectors[s];
  if (wall.nextsector == -1) {
    let nsec = copySector(sec);
    insertSector(board, nsec);
    nsec.wallptr = board.numwalls;
    resizeWalls(board, board.numsectors - 1, 4);

  }
}

function clockwise(walls: Collection<[number, number]>): boolean {
  let minx = Number.MAX_VALUE;
  let minwall = -1;
  for (let w = 0; w < walls.length(); w++) {
    let w2 = cyclic(w + 1, walls.length());
    let wall2 = walls.get(w2);
    if (wall2[0] < minx) {
      minx = wall2[0];
      minwall = w;
    }
  }
  let wall0 = walls.get(minwall);
  let wall1 = walls.get(cyclic(minwall + 1, walls.length()));
  let wall2 = walls.get(cyclic(minwall + 2, walls.length()));

  if (wall2[1] <= wall1[1] && wall1[1] <= wall0[1]) return true;
  if (wall0[1] <= wall1[1] && wall1[1] <= wall2[1]) return false;

  return cross2d(wall0[0] - wall1[0], wall0[1] - wall1[1], wall2[0] - wall1[0], wall2[1] - wall1[1]) < 0;
}

function searchMatchWall(board: Board, p1: [number, number], p2: [number, number]): [number, number] {
  for (let s = 0; s < board.numsectors; s++) {
    let sec = board.sectors[s];
    let end = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < end; w++) {
      let wall1 = board.walls[w];
      if (wall1 == null || wall1.nextwall != -1) continue;
      let wall2 = board.walls[wall1.point2];
      if (wall1.x == p2[0] && wall1.y == p2[1] && wall2.x == p1[0] && wall2.y == p1[1]) {
        return [s, w];
      }
    }
  }
  return null;
}

function matchWalls(board: Board, points: Collection<[number, number]>) {
  let walls = Array<[number, number]>();
  let cw = clockwise(points);
  for (let i = 0; i < points.length(); i++) {
    let i2 = cyclic(i + 1, points.length());
    let idx = cw ? i : reverse(i, points.length() - 1);
    let p1 = points.get(idx);
    let p2 = points.get(cw ? i2 : reverse(i2, points.length() - 1));
    walls[idx] = searchMatchWall(board, p1, p2);
  }
  return walls;
}

function commonSectorWall(board: Board, matched: Array<[number, number]>): [Sector, Wall] {
  for (let i = 0; i < matched.length; i++) {
    let m = matched[i];
    if (m != null) return [board.sectors[m[0]], board.walls[m[1]]];
  }
  return [newSector(), newWall(0, 0)];
}

export function createNewSector(board: Board, points: Collection<[number, number]>) {
  let mwalls = matchWalls(board, points);
  let [commonSector, commonWall] = commonSectorWall(board, mwalls);
  let sector = copySector(commonSector);
  let sectorId = addSector(board, sector);
  let walls = new Deck<Wall>();
  let cw = clockwise(points);
  for (let i = 0; i < points.length(); i++) {
    let idx = cw ? i : reverse(i, points.length() - 1);
    let m = mwalls[idx];
    let p = points.get(idx);
    let baseWall = m == null ? commonWall : board.walls[m[1]];
    let wall = copyWall(baseWall, p[0], p[1]);
    if (m != null) {
      wall.nextwall = m[1];
      wall.nextsector = m[0];
    }
    walls.push(wall);
  }

  loopPoints.clear().push(points.length());
  recreateSectorWalls(board, sectorId, walls, loopPoints);
  for (let w = sector.wallptr; w < sector.wallptr + sector.wallnum; w++) {
    fixxrepeat(board, w);
  }
}

export function createInnerLoop(board: Board, sectorId: number, points: Collection<[number, number]>) {
  let sector = board.sectors[sectorId];
  resizeWalls(board, sectorId, sector.wallnum + points.length());
  let wallPtr = sector.wallptr + sector.wallnum - points.length();
  let firstWall = board.walls[sector.wallptr];
  let ccw = !clockwise(points);
  points = ccw ? points : reversed(points);
  for (let i = 0; i < points.length(); i++) {
    let p = points.get(i);
    let wall = copyWall(firstWall, p[0], p[1]);
    wall.point2 = i == points.length() - 1 ? wallPtr : wallPtr + i + 1;
    wall.nextsector = wall.nextwall = -1;
    board.walls[wallPtr + i] = wall;
  }
  for (let w = wallPtr; w < sector.wallptr + sector.wallnum; w++) {
    fixxrepeat(board, w);
  }
}


let newLoops = new Deck<Wall>();
let restLoop = new Deck<Wall>();
let newLoopLooppoints = new Deck<number>();
function sliceSector(board: Board, sectorId: number, points: Collection<[number, number]>, firstWall: number, lastWall: number): [Deck<Wall>, Deck<number>, Deck<Wall>] {
  newLoops.clear();
  newLoopLooppoints.clear();
  restLoop.clear();
  let sector = board.sectors[sectorId];
  let end = sector.wallptr + sector.wallnum;
  for (let w = sector.wallptr; w < end; w++) {
    let wall = board.walls[w];
    if (w == firstWall) {
      for (let i = 0; i < points.length() - 1; i++) {
        let p = points.get(i);
        newLoops.push(copyWall(wall, p[0], p[1]));
      }
      for (let w1 = w; w1 != lastWall; w1++) {
        restLoop.push(board.walls[w1]);
      }
      w = lastWall;
      wall = board.walls[w];
    }
    newLoops.push(wall);
    if (w > wall.point2) newLoopLooppoints.push(newLoops.length());
  }
  return [newLoops, newLoopLooppoints, restLoop];
}

export function splitSector(board: Board, sectorId: number, points: Collection<[number, number]>) {
  let firstPoint = points.get(0);
  let lastPoint = points.get(points.length() - 1);
  let firstWall = wallInSector(board, sectorId, firstPoint[0], firstPoint[1]);
  let lastWall = wallInSector(board, sectorId, lastPoint[0], lastPoint[1]);
  let loop = loopWalls(board, firstWall, sectorId);
  if (findFirst(loop, lastWall) == -1) return -1;
  [firstWall, lastWall, points] = firstWall > lastWall ? [lastWall, firstWall, reversed(points)] : [firstWall, lastWall, points];
  let [nwalls, looppoints, rest] = sliceSector(board, sectorId, points, firstWall, lastWall);
  recreateSectorWalls(board, sectorId, nwalls, looppoints);
  let sector = copySector(board.sectors[sectorId]);
  let newSectorId = addSector(board, sector);

  nwalls.clear();
  points = reversed(points);
  firstPoint = points.get(0);
  lastPoint = points.get(points.length() - 1);
  firstWall = wallInSector(board, sectorId, firstPoint[0], firstPoint[1]);
  lastWall = wallInSector(board, sectorId, lastPoint[0], lastPoint[1]);
  for (let i = 1; i < points.length(); i++) {
    let p = points.get(i);
    let pp = points.get(i - 1);
    let nextwall = wallInSector(board, sectorId, p[0], p[1]);
    let wall = copyWall(board.walls[nextwall], pp[0], pp[1]);
    wall.nextwall = nextwall;
    wall.nextsector = sectorId;
    nwalls.push(wall);
  }

  nwalls.pushAll(rest);
  looppoints.clear().push(nwalls.length());
  recreateSectorWalls(board, newSectorId, nwalls, looppoints);
  updateSpriteSector(board, sectorId);
  return newSectorId;
}

export function insertSprite(board: Board, x: number, y: number, z: number) {
  let sectorId = findSector(board, x, y, -1);
  if (sectorId == -1) return -1;
  let sprite = newSprite(sectorId, x, y, z);
  board.sprites[board.numsprites++] = sprite;
  return board.numsprites - 1;
}
