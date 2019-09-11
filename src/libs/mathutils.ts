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

export function nextpow2(x: number) {
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

export function monoatan2(y: number, x: number): number {
  let atan = Math.atan2(y, x);
  return atan < 0 ? (4 * Math.PI) + atan : atan;
}

export function angInArc(arcStart: number, arcEnd: number, ang: number): boolean {
  return arcStart > arcEnd ? ang >= arcStart || ang <= arcEnd : ang >= arcStart && ang <= arcEnd;
}

export function arcsIntersects(a1s: number, a1e: number, a2s: number, a2e: number): boolean {
  return angInArc(a1s, a1e, a2s) || angInArc(a1s, a1e, a2e) || angInArc(a2s, a2e, a1s) || angInArc(a2s, a2e, a1e);
}

export function cyclic(x: number, max: number): number {
  return x > 0 ? (x % max) : (max + x % max);
}

export function reverse(x: number, max: number) {
  return max - x;
}

export function ubyte2byte(n: number) {
  var minus = (n & 0x80) != 0;
  return minus ? -(~n & 0xFF) - 1 : n;
}

export function int2vec4(int: number) {
  return [(int & 0xff), ((int >>> 8) & 0xff), ((int >>> 16) & 0xff), ((int >>> 24) & 0xff)];
}

export function int2vec4norm(int: number) {
  return [(int & 0xff) / 256, ((int >>> 8) & 0xff) / 256, ((int >>> 16) & 0xff) / 256, ((int >>> 24) & 0xff) / 256];
}

export function tuple2<T1, T2>(value: [T1, T2], v0: T1, v1: T2): [T1, T2] {
  value[0] = v0;
  value[1] = v1;
  return value;
}

export function tuple3<T1, T2, T3>(value: [T1, T2, T3], v0: T1, v1: T2, v2: T3): [T1, T2, T3] {
  value[0] = v0;
  value[1] = v1;
  value[2] = v2;
  return value;
}
