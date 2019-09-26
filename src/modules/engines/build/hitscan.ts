import { Board, Sector, FACE, WALL, FLOOR } from "./structs";
import { ZSCALE, inSector, slope, rayIntersect, groupSprites, ANGSCALE, inPolygon, spriteAngle } from "./utils";
import { ArtInfoProvider, ArtInfo } from "./art";
import { IndexedDeck, Deck } from "../../deck";
import { int, len2d, cross2d, sqrLen2d, dot2d, PI2, sign } from "../../../libs/mathutils";
import * as GLM from "../../../libs_js/glmatrix";

export enum SubType {
  FLOOR, CEILING, UPPER_WALL, MID_WALL, LOWER_WALL, SPRITE
}

export function isSector(type: SubType) {
  return type == SubType.FLOOR || type == SubType.CEILING;
}

export function isWall(type: SubType) {
  return type == SubType.LOWER_WALL || type == SubType.MID_WALL || type == SubType.UPPER_WALL;
}

export function isSprite(type: SubType) {
  return type == SubType.SPRITE;
}

export class Hitscan {
  constructor(
    public x: number = -1,
    public y: number = -1,
    public z: number = -1,
    public t: number = -1,
    public id: number = -1,
    public type: SubType = null,
    public startzscaled = GLM.vec3.create(),
    public veczscaled = GLM.vec3.create(),
    public start = GLM.vec3.create(),
    public vec = GLM.vec3.create()) { }

  public reset(xs: number, ys: number, zs: number, vx: number, vy: number, vz: number) {
    this.id = -1;
    this.t = -1;
    this.type = null;
    GLM.vec3.set(this.start, xs, ys, zs);
    GLM.vec3.set(this.vec, vx, vy, vz);
    GLM.vec3.set(this.veczscaled, vx, vz, vy);
    GLM.vec3.set(this.startzscaled, xs, zs / ZSCALE, ys);
  }

  private testHit(x: number, y: number, z: number, t: number): boolean {
    if (this.t == -1 || this.t >= t) {
      this.x = x;
      this.y = y;
      this.z = z;
      this.t = t;
      return true;
    }
    return false;
  }

  public hit(x: number, y: number, z: number, t: number, id: number, type: SubType) {
    if (this.testHit(x, y, z, t)) {
      this.id = id;
      this.type = type;
    }
  }
}

function hitSector(board: Board, secId: number, t: number, hit: Hitscan, type: SubType) {
  let x = hit.start[0] + int(hit.vec[0] * t);
  let y = hit.start[1] + int(hit.vec[1] * t);
  let z = hit.start[2] + int(hit.vec[2] * t) * ZSCALE;
  if (inSector(board, x, y, secId))
    hit.hit(x, y, z, t, secId, type);
}

function intersectSectorPlanes(board: Board, sec: Sector, secId: number, hit: Hitscan) {
  let wall1 = board.walls[sec.wallptr]
  let wall2 = board.walls[wall1.point2];
  let dx = wall2.x - wall1.x;
  let dy = wall2.y - wall1.y;
  let dl = len2d(dx, dy);
  if (dl == 0) return;
  let ndx = dx / dl;
  let ndy = dy / dl;
  let angk = -cross2d(ndx, ndy, hit.vec[0], hit.vec[1]);

  let ceilk = sec.ceilingheinum * ANGSCALE * angk;
  let dk = hit.vec[2] - ceilk;
  if (dk > 0) {
    let ceilz = slope(board, secId, hit.start[0], hit.start[1], sec.ceilingheinum) + sec.ceilingz;
    let ceildz = (ceilz - hit.start[2]) / ZSCALE;
    let t = ceildz / dk;
    hitSector(board, secId, t, hit, SubType.CEILING);
  }

  let floork = sec.floorheinum * ANGSCALE * angk;
  let dk1 = floork - hit.vec[2];
  if (dk1 > 0) {
    let floorz = slope(board, secId, hit.start[0], hit.start[1], sec.floorheinum) + sec.floorz;
    let floordz = (hit.start[2] - floorz) / ZSCALE;
    let t = floordz / dk1;
    hitSector(board, secId, t, hit, SubType.FLOOR);
  }
}

function intersectWall(board: Board, wallId: number, hit: Hitscan): number {
  let wall = board.walls[wallId];
  let wall2 = board.walls[wall.point2];
  let x1 = wall.x, y1 = wall.y;
  let x2 = wall2.x, y2 = wall2.y;
  let [xs, ys, zs] = hit.start;
  let [vx, vy, vz] = hit.vec;

  if (cross2d(x1 - xs, y1 - ys, x2 - xs, y2 - ys) <= 0) return -1;

  let intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null) return -1;
  let [ix, iy, iz, it] = intersect;

  let nextsecId = wall.nextsector;
  if (nextsecId == -1) {
    hit.hit(ix, iy, iz, it, wallId, SubType.MID_WALL);
    return -1;
  }

  let nextsec = board.sectors[nextsecId];
  let floorz = slope(board, nextsecId, ix, iy, nextsec.floorheinum) + nextsec.floorz;
  let ceilz = slope(board, nextsecId, ix, iy, nextsec.ceilingheinum) + nextsec.ceilingz;
  if (iz <= ceilz) {
    hit.hit(ix, iy, iz, it, wallId, SubType.UPPER_WALL);
    return -1;
  } else if (iz >= floorz) {
    hit.hit(ix, iy, iz, it, wallId, SubType.LOWER_WALL);
    return -1;
  } else if (wall.cstat.masking) {
    hit.hit(ix, iy, iz, it, wallId, SubType.MID_WALL);
    return -1;
  }

  return nextsecId;
}

function intersectFaceSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  let [xs, ys, zs] = hit.start;
  let [vx, vy, vz] = hit.vec;
  if (vx == 0 && vy == 0) return;
  let spr = board.sprites[sprId];
  let x = spr.x, y = spr.y, z = spr.z;
  let dx = x - xs; let dy = y - ys;
  let vl = sqrLen2d(vx, vy);
  let t = dot2d(vx, vy, dx, dy) / vl;
  if (t <= 0) return;
  let intz = zs + int(vz * t) * ZSCALE;
  let h = info.h * (spr.yrepeat << 2);
  z += spr.cstat.realCenter ? h >> 1 : 0;
  z -= info.attrs.yoff * (spr.yrepeat << 2);
  if ((intz > z) || (intz < z - h)) return;
  let intx = xs + int(vx * t);
  let inty = ys + int(vy * t);
  let w = info.w * (spr.xrepeat >> 2);
  if (len2d(x - intx, y - inty) > (w >> 1)) return;
  hit.hit(intx, inty, intz, t, sprId, SubType.SPRITE);
}

function intersectWallSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  let [xs, ys, zs] = hit.start;
  let [vx, vy, vz] = hit.vec;
  if (vx == 0 && vy == 0) return;
  let spr = board.sprites[sprId];
  let x = spr.x, y = spr.y, z = spr.z;
  let ang = spriteAngle(spr.ang);
  let dx = Math.sin(ang) * (spr.xrepeat >> 2);
  let dy = Math.cos(ang) * (spr.xrepeat >> 2);
  let w = info.w;
  let xoff = info.attrs.xoff + spr.xoffset;
  if (spr.cstat.xflip) xoff = -xoff;
  let hw = (w >> 1) + xoff;
  let x1 = x - dx * hw; let y1 = y - dy * hw;
  let x2 = x1 + dx * w; let y2 = y1 + dy * w;
  if (spr.cstat.onesided && cross2d(x1 - xs, y1 - ys, x2 - xs, y2 - ys) > 0) return;
  let intersect = rayIntersect(xs, ys, zs, vx, vy, vz, x1, y1, x2, y2);
  if (intersect == null) return;
  let [ix, iy, iz, it] = intersect;
  let h = info.h * (spr.yrepeat << 2);
  z += spr.cstat.realCenter ? h >> 1 : 0;
  z -= info.attrs.yoff * (spr.yrepeat << 2);
  if ((iz > z) || (iz < z - h)) return;
  hit.hit(ix, iy, iz, it, sprId, SubType.SPRITE);
}

let xss = new Deck<number>();
let yss = new Deck<number>();
function intersectFloorSprite(board: Board, info: ArtInfo, sprId: number, hit: Hitscan) {
  let [xs, ys, zs] = hit.start;
  let [vx, vy, vz] = hit.vec;
  if (vz == 0) return;
  let spr = board.sprites[sprId];
  let x = spr.x, y = spr.y, z = spr.z;
  let dz = (z - zs) / ZSCALE;
  if (sign(dz) != sign(vz)) return;
  if (spr.cstat.onesided && (spr.cstat.yflip == 1) == zs < z) return;

  let xoff = 0;//(info.attrs.xoff + spr.xoffset) * (spr.cstat.xflip ? -1 : 1);
  let yoff = 0;//(info.attrs.yoff + spr.yoffset) * (spr.cstat.yflip ? -1 : 1);
  let ang = spriteAngle(spr.ang);
  let cosang = Math.cos(ang);
  let sinang = Math.sin(ang);
  let dx = ((info.w >> 1) + xoff) * (spr.xrepeat >> 2);
  let dy = ((info.h >> 1) + yoff) * (spr.yrepeat >> 2);
  let dw = info.w * (spr.xrepeat >> 2);
  let dh = info.h * (spr.yrepeat >> 2);

  let x1 = int(x + sinang * dx + cosang * dy);
  let y1 = int(y + sinang * dy - cosang * dx);
  let x2 = int(x1 - sinang * dw);
  let y2 = int(y1 + cosang * dw);
  let x3 = int(x2 - cosang * dh);
  let y3 = int(y2 - sinang * dh);
  let x4 = int(x1 - cosang * dh);
  let y4 = int(y1 - sinang * dh);
  xss.clear().push(x1).push(x2).push(x3).push(x4);
  yss.clear().push(y1).push(y2).push(y3).push(y4);

  let t = dz / vz;
  let ix = xs + int(vx * t);
  let iy = ys + int(vy * t);
  if (!inPolygon(ix, iy, xss, yss)) return;
  hit.hit(ix, iy, z, t, sprId, SubType.SPRITE);
}


function intersectSprite(board: Board, artInfo: ArtInfoProvider, sprId: number, hit: Hitscan) {
  let spr = board.sprites[sprId];
  if (spr.picnum == 0 || spr.cstat.invisible) return;
  let info = artInfo.getInfo(spr.picnum);
  if (spr.cstat.type == FACE) {
    intersectFaceSprite(board, info, sprId, hit);
  } else if (spr.cstat.type == WALL) {
    intersectWallSprite(board, info, sprId, hit);
  } else if (spr.cstat.type == FLOOR) {
    intersectFloorSprite(board, info, sprId, hit);
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
  hit.reset(xs, ys, zs, vx, vy, vz);

  resetStack(board, secId, stack);
  let sprites = groupSprites(board);
  for (let i = 0; i < stack.length(); i++) {
    let s = stack.get(i);
    let sec = board.sectors[s];
    intersectSectorPlanes(board, sec, s, hit);

    let endwall = sec.wallptr + sec.wallnum;
    for (let w = sec.wallptr; w < endwall; w++) {
      let nextsec = intersectWall(board, w, hit);
      if (nextsec != -1 && stack.indexOf(nextsec) == -1) {
        stack.push(nextsec);
      }
    }

    let sprs = sprites[s];
    if (sprs == undefined) continue;
    for (let j = 0; j < sprs.length; j++) {
      intersectSprite(board, artInfo, sprs[j], hit);
    }
  }
}
