import * as MU from '../../../libs/mathutils';
import * as VEC from '../../../libs/vecmath';
import * as GLM from '../../../libs_js/glmatrix';
import { Board, Sprite, Sector, Wall, FACE, WALL, FLOOR } from './structs';
import { ArtInfoProvider } from './art';
import { IndexedDeck } from '../../deck';

export const ZSCALE = -16;

export function getPlayerStart(board: Board): Sprite {
  for (let i = 0; i < board.numsprites; i++) {
    let sprite = board.sprites[i];
    if (sprite.lotag == 1)
      return sprite;
  }
  return null;
}

export class MoveStruct {
  public x: number;
  public y: number;
  public z: number;
  public sec: number;
  public xvel: number;
  public yvel: number;
  public zvel: number;
}

export function getSector(board: Board, ms: MoveStruct): number {
  if (inSector(board, ms.x, ms.y, ms.sec))
    return ms.sec;
  return -1;
}

export function inSector(board: Board, x: number, y: number, secnum: number): boolean {
  x = MU.int(x);
  y = MU.int(y);
  let sec = board.sectors[secnum];
  if (!sec) return false;
  let inter = 0;
  for (let w = 0; w < sec.wallnum; w++) {
    let wallidx = w + sec.wallptr;
    let wall = board.walls[wallidx];
    let wall2 = board.walls[wall.point2];
    let dy1 = wall.y - y;
    let dy2 = wall2.y - y;

    if ((dy1 ^ dy2) < 0) {
      let dx1 = wall.x - x;
      let dx2 = wall2.x - x;
      if ((dx1 ^ dx2) >= 0)
        inter ^= dx1;
      else
        inter ^= MU.cross2d(dx1, dy1, dx2, dy2) ^ dy2;
    }
  }
  return (inter >>> 31) == 1;
}

export function sectorOfWall(board: Board, wallId: number): number {
  if (wallId < 0 || wallId >= board.numwalls)
    return -1;
  let wall = board.walls[wallId];
  if (wall.nextwall != -1)
    return board.walls[wall.nextwall].nextsector;
  let start = 0;
  let end = board.numsectors - 1;
  while (end - start >= 0) {
    let pivot = MU.int(start + (end - start) / 2);
    let sec = board.sectors[pivot];
    if (sec.wallptr <= wallId && sec.wallptr + sec.wallnum >= wallId)
      return pivot;
    if (sec.wallptr > wallId) {
      end = pivot - 1;
    } else {
      start = pivot + 1;
    }
  }
}

export function sectorZ(board: Board, sectorId: number, type: Type) {
  let sec = board.sectors[sectorId];
  return (type == Type.CEILING ? sec.ceilingz : sec.floorz);
}

export function sectorHeinum(board: Board, sectorId: number, type: Type) {
  let sec = board.sectors[sectorId];
  return (type == Type.CEILING ? sec.ceilingheinum : sec.floorheinum);
}

export function setSectorZ(board: Board, sectorId: number, type: Type, z: number): boolean {
  let pz = sectorZ(board, sectorId, type);
  if (pz == z) return false;
  let sec = board.sectors[sectorId];
  if (type == Type.CEILING) sec.ceilingz = z; else sec.floorz = z;
  return true;
}

export function setSectorHeinum(board: Board, sectorId: number, type: Type, h: number): boolean {
  let ph = sectorHeinum(board, sectorId, type);
  if (ph == h) return false;
  let sec = board.sectors[sectorId];
  if (type == Type.CEILING) sec.ceilingheinum = h; else sec.floorheinum = h;
  return true;
}

export function findSector(board: Board, x: number, y: number, secnum: number = -1): number {
  if (secnum == -1)
    return findSectorAll(board, x, y);
  let secs = [secnum];
  for (let i = 0; i < secs.length; i++) {
    secnum = secs[i];
    let sec = board.sectors[secnum];
    if (inSector(board, x, y, secnum))
      return secnum;

    for (let w = 0; w < sec.wallnum; w++) {
      let wallidx = w + sec.wallptr;
      let wall = board.walls[wallidx];
      if (wall.nextsector != -1) {
        let nextsector = wall.nextsector;
        if (secs.indexOf(nextsector) == -1)
          secs.push(nextsector);
      }
    }
  }
  return -1;
}

function findSectorAll(board: Board, x: number, y: number) {
  for (let s = 0; s < board.numsectors; s++) {
    let sec = board.sectors[s];
    if (inSector(board, x, y, s))
      return s;
  }
  return -1;
}

export function getSprites(board: Board, secnum: number): number[] {
  let ret = [];
  let sprites = board.sprites;
  for (let i = 0; i < sprites.length; i++) {
    if (sprites[i].sectnum == secnum)
      ret.push(i);
  }
  return ret;
}

export function groupSprites(board: Board): { [index: number]: number[] } {
  let sec2spr: { [index: number]: number[] } = {};
  for (let s = 0; s < board.numsprites; s++) {
    let spr = board.sprites[s];
    let sprs = sec2spr[spr.sectnum];
    if (sprs == undefined) {
      sprs = [];
      sec2spr[spr.sectnum] = sprs;
    }
    sprs.push(s);
  }
  return sec2spr;
}

let ANGSCALE = (1 / 4096);

export function slope(board: Board, sectorId: number, x: number, y: number, heinum: number) {
  let sec = board.sectors[sectorId];
  let wall1 = board.walls[sec.wallnum];
  let wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let ln = MU.len2d(dx, dy);
  dx /= ln; dy /= ln;
  let dx1 = x - wall1.x;
  let dy1 = y - wall1.y;
  let k = MU.cross2d(dx, dy, dx1, dy1);
  return MU.int(heinum * ANGSCALE * k * -ZSCALE);
}

export function createSlopeCalculator(sector: Sector, walls: Wall[]) {
  let wall1 = walls[sector.wallptr];
  let wall2 = walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let ln = MU.len2d(dx, dy);
  dx /= ln; dy /= ln;

  return function (x: number, y: number, heinum: number): number {
    let dx1 = x - wall1.x;
    let dy1 = y - wall1.y;
    let k = MU.cross2d(dx, dy, dx1, dy1);
    return MU.int(heinum * ANGSCALE * k * -ZSCALE);
  };
}

export function heinumCalc(board: Board, sectorId: number, x: number, y: number, z: number) {
  let sec = board.sectors[sectorId];
  let wall1 = board.walls[sec.wallptr];
  let wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let ln = MU.len2d(dx, dy);
  dx /= ln; dy /= ln;
  let dx1 = x - wall1.x;
  let dy1 = y - wall1.y;
  let k = MU.cross2d(dx, dy, dx1, dy1);
  return Math.round(z / (ANGSCALE * k * -ZSCALE));
}

export function lineIntersect(
  x1: number, y1: number, z1: number,
  x2: number, y2: number, z2: number,
  x3: number, y3: number, x4: number, y4: number): number[] {

  let x21 = x2 - x1, x34 = x3 - x4;
  let y21 = y2 - y1, y34 = y3 - y4;
  let bot = MU.cross2d(x21, y21, x34, y34);

  if (bot == 0) return null;

  let x31 = x3 - x1, y31 = y3 - y1;
  let topt = MU.cross2d(x31, y31, x34, y34);

  if (bot > 0) {
    if ((topt < 0) || (topt >= bot))
      return null;
    let topu = MU.cross2d(x21, y31, x31, y31);
    if ((topu < 0) || (topu >= bot))
      return null;
  } else {
    if ((topt > 0) || (topt <= bot))
      return null;
    let topu = MU.cross2d(x21, y21, x31, y31);
    if ((topu > 0) || (topu <= bot))
      return null;
  }

  let t = topt / bot;
  let x = x1 + MU.int(x21 * t);
  let y = y1 + MU.int(y21 * t);
  let z = z1 + MU.int((z2 - z1) * t) * -ZSCALE;

  return [x, y, z, t];
}

export function rayIntersect(
  x1: number, y1: number, z1: number,
  vx: number, vy: number, vz: number,
  x3: number, y3: number, x4: number, y4: number): number[] {

  let x34 = x3 - x4;
  let y34 = y3 - y4;
  let bot = MU.cross2d(vx, vy, x34, y34);
  if (bot == 0) return null;
  let x31 = x3 - x1;
  let y31 = y3 - y1;
  let topt = MU.cross2d(x31, y31, x34, y34);

  if (bot > 0) {
    if (topt < 0) return null;
    let topu = MU.cross2d(vx, vy, x31, y31);
    if ((topu < 0) || (topu >= bot))
      return null;
  } else {
    if (topt > 0) return null;
    let topu = MU.cross2d(vx, vy, x31, y31);
    if ((topu > 0) || (topu <= bot))
      return null;
  }

  let t = topt / bot;
  let x = x1 + MU.int(vx * t);
  let y = y1 + MU.int(vy * t);
  let z = z1 + MU.int(vz * t) * -ZSCALE;

  return [x, y, z, t];
}


export enum Type {
  FLOOR, CEILING, UPPER_WALL, MID_WALL, LOWER_WALL, SPRITE
}

export function isSector(type: Type) {
  return type == Type.FLOOR || type == Type.CEILING;
}

export function isWall(type: Type) {
  return type == Type.LOWER_WALL || type == Type.MID_WALL || type == Type.UPPER_WALL;
}

export function isSprite(type: Type) {
  return type == Type.SPRITE;
}

export class Hitscan {
  constructor(
    public x: number = -1,
    public y: number = -1,
    public z: number = -1,
    public t: number = -1,
    public id: number = -1,
    public type: Type = null
  ) { }

  public reset() {
    this.id = -1;
    this.t = -1;
    this.type = null;
  }

  private testHit(x: number, y: number, z: number, t: number): boolean {
    if (this.t == -1 || this.t >= t) {
      this.x = x; this.y = y; this.z = z; this.t = t;
      return true;
    }
    return false;
  }

  public hit(x: number, y: number, z: number, t: number, id: number, type: Type) {
    if (this.testHit(x, y, z, t)) {
      this.id = id;
      this.type = type;
    }
  }
}


function hitSector(board: Board, secId: number, xs: number, ys: number, zs: number, vx: number, vy: number, vz: number, t: number, hit: Hitscan, type: Type) {
  let x = xs + MU.int(vx * t);
  let y = ys + MU.int(vy * t);
  let z = zs + MU.int(vz * t) * -ZSCALE;
  if (inSector(board, x, y, secId))
    hit.hit(x, y, z, t, secId, type);
}

function intersectSectorPlanes(board: Board, sec: Sector, secId: number, xs: number, ys: number, zs: number, vx: number, vy: number, vz: number, hit: Hitscan) {
  let vl = MU.len2d(vx, vy);
  let nvx = vx / vl;
  let nvy = vy / vl;

  let wall1 = board.walls[sec.wallptr]
  let wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let dl = MU.len2d(dx, dy);
  if (dl == 0) return;
  let ndx = dx / dl;
  let ndy = dy / dl;
  let angk = MU.cross2d(ndx, ndy, nvx, nvy);

  let ceilk = sec.ceilingheinum * ANGSCALE * angk;
  let dk = ceilk - vz;
  if (dk > 0) {
    let ceilz = slope(board, secId, xs, ys, sec.ceilingheinum) + sec.ceilingz;
    let ceildz = (zs - ceilz) / -ZSCALE;
    let t = ceildz / dk;
    hitSector(board, secId, xs, ys, zs, vx, vy, vz, t, hit, Type.CEILING);
  }

  let floork = sec.floorheinum * ANGSCALE * angk;
  let dk1 = vz - floork;
  if (dk1 > 0) {
    let floorz = slope(board, secId, xs, ys, sec.floorheinum) + sec.floorz;
    let floordz = (floorz - zs) / -ZSCALE;
    let t = floordz / dk1;
    hitSector(board, secId, xs, ys, zs, vx, vy, vz, t, hit, Type.FLOOR);
  }
}

function canIntersect(xs: number, ys: number, x1: number, y1: number, x2: number, y2: number) {
  return (x1 - xs) * (y2 - ys) >= (x2 - xs) * (y1 - ys);
}

function intersectWall(board: Board, wallId: number, xs: number, ys: number, zs: number, vx: number, vy: number, vz: number, hit: Hitscan): number {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  let x1 = wall.x, y1 = wall.y;
  let x2 = wall2.x, y2 = wall2.y;

  if (!canIntersect(xs, ys, x1, y1, x2, y2)) return -1;

  let intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null) return -1;
  let [ix, iy, iz, it] = intersect;

  let nextsecId = wall.nextsector;
  if (nextsecId == -1) {
    hit.hit(ix, iy, iz, it, wallId, Type.MID_WALL);
    return -1;
  }

  let nextsec = board.sectors[nextsecId];
  let floorz = slope(board, nextsecId, ix, iy, nextsec.floorheinum) + nextsec.floorz;
  let ceilz = slope(board, nextsecId, ix, iy, nextsec.ceilingheinum) + nextsec.ceilingz;
  if (iz <= ceilz) {
    hit.hit(ix, iy, iz, it, wallId, Type.UPPER_WALL);
    return -1;
  } else if (iz >= floorz) {
    hit.hit(ix, iy, iz, it, wallId, Type.LOWER_WALL);
    return -1;
  } else if (wall.cstat.masking) {
    hit.hit(ix, iy, iz, it, wallId, Type.MID_WALL);
    return -1;
  }

  return nextsecId;
}

function intersectSprite(board: Board, artInfo: ArtInfoProvider, sprId: number, xs: number, ys: number, zs: number, vx: number, vy: number, vz: number, hit: Hitscan) {
  let spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible)
    return;
  let x = spr.x, y = spr.y, z = spr.z;
  let info = artInfo.getInfo(spr.picnum);
  if (spr.cstat.type == FACE) {
    let dx = x - xs; let dy = y - ys;
    let vl = MU.sqrLen2d(vx, vy);
    if (vl == 0) return;
    let t = MU.dot2d(vx, vy, dx, dy) / vl;
    if (t <= 0) return;
    let intz = zs + MU.int(vz * t) * -ZSCALE;
    let h = info.h * spr.yrepeat << 2;
    z += spr.cstat.realCenter ? h >> 1 : 0;
    z -= info.attrs.yoff * spr.yrepeat << 2;
    if ((intz > z) || (intz < z - h)) return;
    let intx = xs + MU.int(vx * t);
    let inty = ys + MU.int(vy * t);
    let w = info.w * spr.xrepeat >> 2;
    if (MU.len2d(x - intx, y - inty) > w >> 1) return;
    hit.hit(intx, inty, intz, t, sprId, Type.SPRITE);
  } else if (spr.cstat.type == WALL) {
    let ang = MU.PI2 - (spr.ang / 2048) * MU.PI2;
    let dx = Math.sin(ang) * spr.xrepeat >> 2;
    let dy = Math.cos(ang) * spr.xrepeat >> 2;
    let w = info.w;
    let xoff = info.attrs.xoff + spr.xoffset;
    if (spr.cstat.xflip) xoff = -xoff;
    let hw = (w >> 1) + xoff;
    let x1 = x - dx * hw; let y1 = y - dy * hw;
    let x2 = x1 + dx * w; let y2 = y1 + dy * w;
    if (spr.cstat.onesided && !canIntersect(xs, ys, x1, y1, x2, y2)) return;
    let intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
    if (intersect == null) return;
    let [ix, iy, iz, it] = intersect;
    let h = info.h * spr.yrepeat << 2;
    z += spr.cstat.realCenter ? h >> 1 : 0;
    z -= info.attrs.yoff * spr.yrepeat << 2
    if ((iz > z) || (iz < z - h)) return;
    hit.hit(ix, iy, iz, it, sprId, Type.SPRITE);
  } else if (spr.cstat.type == FLOOR) {
    if (vz == 0) return;
    if (((z - zs) ^ vz) < 0) return;
    if (spr.cstat.onesided && (spr.cstat.yflip == 1) == zs > z) return;
    let dz = z - zs;
    let ix = xs + dz * vx / vz;
    let iy = ys + dz * vy / vz;
    let xoff = info.attrs.xoff + spr.xoffset;
    let yoff = info.attrs.yoff + spr.yoffset;
    if (spr.cstat.xflip) xoff = -xoff;
    if (spr.cstat.yflip) yoff = -yoff;
    let ang = MU.PI2 - (spr.ang / 2048) * MU.PI2;
    let cosang = Math.cos(ang);
    let sinang = Math.sin(ang);
    let dx = (info.w >> 1 + xoff) * spr.xrepeat;
    let dy = (info.h >> 1 + yoff) * spr.yrepeat;
    let dw = info.w * spr.xrepeat << 2; let dh = info.h * spr.yrepeat << 2;
    let x1 = x + sinang * dx + cosang * dy - ix; let y1 = y + sinang * dy - cosang * dx - iy;
    let x2 = x1 - sinang * dw; let y2 = y1 - cosang * dw;
    let x3 = x2 - cosang * dh; let y3 = y2 - sinang * dh;
    let x4 = x1 - cosang * dh; let y4 = y1 - sinang * dh;

    let clipyou = 0;
    if ((y1 ^ y2) < 0) {
      if ((x1 ^ x2) < 0) clipyou ^= ((x1 * y2 < x2 * y1) ? 1 : 0) ^ ((y1 < y2) ? 1 : 0);
      else if (x1 >= 0) clipyou ^= 1;
    }
    if ((y2 ^ y3) < 0) {
      if ((x2 ^ x3) < 0) clipyou ^= ((x2 * y3 < x3 * y2) ? 1 : 0) ^ ((y2 < y3) ? 1 : 0);
      else if (x2 >= 0) clipyou ^= 1;
    }
    if ((y3 ^ y4) < 0) {
      if ((x3 ^ x4) < 0) clipyou ^= ((x3 * y4 < x4 * y3) ? 1 : 0) ^ ((y3 < y4) ? 1 : 0);
      else if (x3 >= 0) clipyou ^= 1;
    }
    if ((y4 ^ y1) < 0) {
      if ((x4 ^ x1) < 0) clipyou ^= ((x4 * y1 < x1 * y4) ? 1 : 0) ^ ((y4 < y1) ? 1 : 0);
      else if (x4 >= 0) clipyou ^= 1;
    }
    if (clipyou == 0) return;
    hit.hit(ix, iy, z, vz / dz, sprId, Type.SPRITE);
  }
}

function resetStack(board: Board, sectorId: number, stack: IndexedDeck<number>): void {
  stack.clear();
  if (sectorId != -1) {
    stack.push(sectorId);
    return;
  }
  for (let i = 0; i < board.numsectors; i++)
    stack.push(i);
}

let stack = new IndexedDeck<number>();
export function hitscan(board: Board, artInfo: ArtInfoProvider, xs: number, ys: number, zs: number, secId: number, vx: number, vy: number, vz: number, hit: Hitscan, cliptype: number) {
  hit.reset();

  resetStack(board, secId, stack);
  let sprites = groupSprites(board);
  for (let i = 0; i < stack.length(); i++) {
    let s = stack.get(i);
    let sec = board.sectors[s];
    intersectSectorPlanes(board, sec, s, xs, ys, zs, vx, vy, vz, hit);

    let endwall = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < endwall; w++) {
      let nextsec = intersectWall(board, w, xs, ys, zs, vx, vy, vz, hit);
      if (nextsec != -1 && stack.indexOf(nextsec) == -1) {
        stack.push(nextsec);
      }
    }

    let sprs = sprites[s];
    if (sprs == undefined) continue;
    for (let j = 0; j < sprs.length; j++) {
      intersectSprite(board, artInfo, sprs[j], xs, ys, zs, vx, vy, vz, hit);
    }
  }
}

export function getFirstWallAngle(sector: Sector, walls: Wall[]): number {
  let w1 = walls[sector.wallptr];
  let w2 = walls[w1.point2];
  let dx = w2.x - w1.x;
  let dy = w2.y - w1.y;
  return Math.atan2(-dy, dx);
}

export function wallVisible(board: Board, wallId: number, ms: MoveStruct) {
  let wall1 = board.walls[wallId];
  let wall2 = board.walls[wall1.point2];
  let dx1 = wall2.x - wall1.x;
  let dy1 = wall2.y - wall1.y;
  let dx2 = ms.x - wall1.x;
  let dy2 = ms.y - wall1.y;
  return MU.cross2d(dx1, dy1, dx2, dy2) >= 0;
}

let normal = GLM.vec2.create();
export function wallNormal(out: GLM.Vec3Array, board: Board, wallId: number): GLM.Vec3Array {
  let w1 = board.walls[wallId];
  let w2 = board.walls[w1.point2];
  GLM.vec2.set(normal, w1.x - w2.x, w1.y - w2.y);
  VEC.normal2d(normal, normal);
  GLM.vec3.set(out, normal[0], 0, normal[1]);
  return out;
}

let wn = GLM.vec3.create();
let up = GLM.vec3.fromValues(0, 1, 0);
let down = GLM.vec3.fromValues(0, -1, 0);
export function sectorNormal(out: GLM.Vec3Array, board: Board, sectorId: number, ceiling: boolean): GLM.Vec3Array {
  let sec = board.sectors[sectorId];
  wallNormal(wn, board, sec.wallptr);
  GLM.vec3.negate(wn, wn);
  let h = ceiling ? sec.ceilingheinum : sec.floorheinum;
  let normal = ceiling ? down : up;
  GLM.vec3.lerp(out, normal, wn, Math.atan(h * ANGSCALE) / (Math.PI / 2));
  return out;
}

export function ang2vec(ang: number): GLM.Vec3Array {
  ang += Math.PI / 2;
  return GLM.vec3.fromValues(Math.sin(ang), 0, Math.cos(ang))
}
