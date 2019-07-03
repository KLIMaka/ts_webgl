export var radsInDeg = 180 / Math.PI;
export var degInRad = Math.PI / 180;
export var PI2 = Math.PI * 2;
export var EPS = 1e-9;

export function deg2rad(deg: number): number {
  return deg * degInRad;
}

export function rad2deg(rad: number): number {
  return rad * radsInDeg;
}

export function sign(x: number) {
  return x > 0 ? 1 : x < 0 ? -1 : 0;
}

export function int(x: number) {
  return x | 0;
}

export function ispow2(x: number): boolean {
  return (x & (x - 1)) == 0;
}

export function fract(x: number): number {
  return x - int(x);
}

export function nextpow2(x) {
  --x;
  for (var i = 1; i < 32; i <<= 1) {
    x = x | x >> i;
  }
  return x + 1;
}

export function sqrLen2d(x: number, y: number) {
  return x * x + y * y;
}

export function len2d(x: number, y: number) {
  return Math.sqrt(x * x + y * y);
}

export function len3d(x: number, y: number, z: number) {
  return Math.sqrt(x * x + y * y + z * z);
}

export function dot2d(x1: number, y1: number, x2: number, y2: number) {
  return x1 * x2 + y1 * y2;
}

export function cross2d(x1: number, y1: number, x2: number, y2: number) {
  return x1 * y2 - y1 * x2;
}

export function monoatan2(y:number, x:number): number {
  let atan = Math.atan2(y, x);
  return atan < 0 ? (4*Math.PI) + atan : atan;
}

export function angInArc(arcStart: number, arcEnd:number, ang:number) :boolean {
  return arcStart > arcEnd ? ang >= arcStart || ang <= arcEnd : ang >= arcStart && ang <= arcEnd;
}

export function arcsIntersects(a1s: number, a1e: number, a2s: number, a2e:number): boolean {
  return angInArc(a1s, a1e, a2s) || angInArc(a1s, a1e, a2e) || angInArc(a2s, a2e, a1s) || angInArc(a2s, a2e, a1e);
}

export function cyclic(x: number, max: number): number {
  return x > 0 ? (x % max) : (max + x % max);
}

export function ubyte2byte(n: number) {
  var minus = (n & 0x80) != 0;
  return minus ? -(~n & 0xFF) - 1 : n;
}

export class BBox {
  constructor(
    public minx: number,
    public maxx: number,
    public miny: number,
    public maxy: number,
    public minz: number,
    public maxz: number
  ) { }

  public grow(bbox: BBox): BBox {
    this.minx = Math.min(this.minx, bbox.minx);
    this.miny = Math.min(this.miny, bbox.miny);
    this.minz = Math.min(this.minz, bbox.minz);
    this.maxx = Math.max(this.maxx, bbox.maxx);
    this.maxy = Math.max(this.maxy, bbox.maxy);
    this.maxz = Math.max(this.maxz, bbox.maxz);
    return this;
  }
}

export function bbox(vtxs: number[][]): BBox {
  var minx = vtxs[0][0];
  var maxx = vtxs[0][0];
  var miny = vtxs[0][1];
  var maxy = vtxs[0][1];
  var minz = vtxs[0][2];
  var maxz = vtxs[0][2];

  var len = vtxs.length;
  for (var i = 0; i < len; i++) {
    var v = vtxs[i];
    minx = Math.min(v[0], minx);
    miny = Math.min(v[1], miny);
    minz = Math.min(v[2], minz);
    maxx = Math.max(v[0], maxx);
    maxy = Math.max(v[1], maxy);
    maxz = Math.max(v[2], maxz);
  }
  return new BBox(minx, maxx, miny, maxy, minz, maxz);
}

export function int2vec4(int: number) {
  return [(int & 0xff), ((int >>> 8) & 0xff), ((int >>> 16) & 0xff), ((int >>> 24) & 0xff)];
}

export function int2vec4norm(int: number) {
  return [(int & 0xff) / 256, ((int >>> 8) & 0xff) / 256, ((int >>> 16) & 0xff) / 256, ((int >>> 24) & 0xff) / 256];
}
