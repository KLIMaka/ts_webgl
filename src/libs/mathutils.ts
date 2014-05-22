
import GLM = require('../libs_js/glmatrix');

var radsInDeg = 180 / Math.PI;
var degInRad = Math.PI / 180;
var PI2 = Math.PI*2;

export function deg2rad(deg:number):number {
  return deg * degInRad;
}

export function rad2deg(rad:number):number {
  return rad * radsInDeg;
}

export function sign(x:number) { 
  return x > 0 ? 1 : x < 0 ? -1 : 0; 
}

export function int(x:number) {
  return x|0;
}

export function mat3FromMat4(out:GLM.Mat3Array, a:GLM.Mat4Array):GLM.Mat3Array {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[4];
  out[4] = a[5];
  out[5] = a[6];
  out[6] = a[8];
  out[7] = a[9];
  out[8] = a[10];
  return out;
}

export function isCW(polygon:number[][]):boolean {
  var toNext = GLM.vec2.create();
  var toPrev = GLM.vec2.create();
  var angsum = 0;
  var N = polygon.length;
  for (var i = 0; i < N; i++) {
    var curr = polygon[i];
    var prev = polygon[i == 0 ? N - 1 : i - 1];
    var next = polygon[i == N - 1 ? 0 : i + 1];
    GLM.vec2.sub(toNext, next, curr); GLM.vec2.normalize(toNext, toNext);
    GLM.vec2.sub(toPrev, prev, curr); GLM.vec2.normalize(toPrev, toPrev);
    var angToNext = Math.acos(toNext[0]);
    angToNext = toNext[1] < 0 ? PI2 - angToNext : angToNext;
    var angToPrev = Math.acos(toPrev[0]);
    angToPrev = toPrev[1] < 0 ? PI2 - angToPrev : angToPrev;
    var ang = angToNext - angToPrev;
    angsum += (ang < 0 ? PI2 + ang : ang);
  }
  return rad2deg(angsum) == 180*(N-2);
}

var a = GLM.vec3.create();
var b = GLM.vec3.create();

export function normal(verts:number[][]) {
  GLM.vec3.sub(a, verts[1], verts[0]);
  GLM.vec3.sub(b, verts[2], verts[0]);
  var res = GLM.vec3.create();
  GLM.vec3.cross(res, b, a);
  GLM.vec3.normalize(res, res);
  return res;
}

export function int2vec4(int:number) {
  return [(int&0xff), ((int>>>8)&0xff), ((int>>>16)&0xff), ((int>>>24)&0xff)];
}

export function int2vec4norm(int:number) {
  return [(int&0xff)/256, ((int>>>8)&0xff)/256, ((int>>>16)&0xff)/256, ((int>>>24)&0xff)/256];
}
