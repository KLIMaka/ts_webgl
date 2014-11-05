
import GLM = require('../libs_js/glmatrix');

var radsInDeg = 180 / Math.PI;
var degInRad = Math.PI / 180;
var PI2 = Math.PI*2;
var EPS = 1e-9;

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

export function ispow2(x:number):boolean {
  return (x & (x-1)) == 0;
}

export function nextpow2(x) {
  --x;
  for (var i = 1; i < 32; i <<= 1) {
    x = x | x >> i;
  }
  return x + 1;
}

export function intersect2d(p1s:number[], p1e:number[], p2s:number[], p2e:number[]):number[] {
  var t = intersect2dT(p1s, p1e, p2s, p2e);
  if (t == null)
    return null;
  return GLM.vec2.lerp(GLM.vec2.create(), p1s, p2e, t);
}

export function intersect2dT(p1s:number[], p1e:number[], p2s:number[], p2e:number[]):number {
  var d = (p1s[0]-p1e[0])*(p2s[1]-p2e[1]) - (p1s[1]-p1e[1])*(p2s[0]-p2e[0]);
  if (Math.abs(d) < EPS)
    return null;
  var res = [
    ((p1s[0]*p1e[1]-p1s[1]*p1e[0])*(p2s[0]-p2e[0]) - (p1s[0]-p1e[0])*(p2s[0]*p2e[1]-p2s[1]*p2e[0])) / d,
    ((p1s[0]*p1e[1]-p1s[1]*p1e[0])*(p2s[1]-p2e[1]) - (p1s[1]-p1e[1])*(p2s[0]*p2e[1]-p2s[1]*p2e[0])) / d
  ];

  var dx1 = p1e[0]-p1s[0];
  var dy1 = p1e[1]-p1s[1];
  var dot1 = ((res[0]-p1s[0])*dx1 + (res[1]-p1s[1])*dy1) / GLM.vec2.sqrLen([dx1, dy1]);
  if (dot1 < 0.0 || dot1 > 1.0)
    return null;
  var dx2 = p2e[0]-p2s[0];
  var dy2 = p2e[1]-p2s[1];
  var dot2 = ((res[0]-p2s[0])*dx2 + (res[1]-p2s[1])*dy2) / GLM.vec2.sqrLen([dx2, dy2]);
  if (dot2 < 0.0 || dot2 > 1.0)
    return null;

  return dot1;
}

export function direction3d(ps:number[], pe:number[]):number[] {
  var tmp = GLM.vec3.create();
  return GLM.vec3.normalize(tmp, GLM.vec3.sub(tmp, pe, ps));
}

export function resize2d(sx:number, sy:number, ex:number, ey:number, dl:number):number[] {
  var dx = ex-sx;
  var dy = ey-sy;
  var len = Math.sqrt(dx*dx + dy*dy);
  var scale = (len+dl)/len;
  var nx = sx + dx*scale;
  var ny = sy + dy*scale;
  return [nx, ny];
}

export function direction2d(ps:number[], pe:number[]):number[] {
  var tmp = GLM.vec2.create();
  return GLM.vec2.normalize(tmp, GLM.vec2.sub(tmp, pe, ps));
}

export function projectXY(p:number[]):number[] {return p}
export function projectXZ(p:number[]):number[] {return [p[0], p[2]]}
export function projectYZ(p:number[]):number[] {return [p[1], p[2]]}

export function intersect3d(p1s:number[], p1e:number[], p2s:number[], p2e:number[]):number[] {
  var dir1 = direction3d(p1s, p1e);
  var dir2 = direction3d(p2s, p2e);

  var p = 
    (dir1[1]*dir2[0] - dir2[1]*dir1[0]) != 0 ? projectXY :
    (dir1[0]*dir2[1] - dir2[0]*dir1[1]) != 0 ? projectXZ :
    (dir1[1]*dir2[2] - dir2[1]*dir1[2]) != 0 ? projectYZ :
    null;

  if (p == null)
    return null;
  var t = intersect2dT(p(p1s), p(p1e), p(p2s), p(p2e));
  if (t == null)
    return null;
  return GLM.vec3.lerp(GLM.vec3.create(), p1s, p1e, t);
}

var tmpNoraml = GLM.vec2.create();
export function normal2d(v1:number[], v2:number[]):number[] {
  GLM.vec2.sub(tmpNoraml, v2, v1);
  GLM.vec2.normalize(tmpNoraml, tmpNoraml);
  return [-tmpNoraml[1], tmpNoraml[0]];
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


var toNext = GLM.vec2.create();
var toPrev = GLM.vec2.create(); 
//
//   p1     p3
//    \ ang /
//     \ ^ /
//      \ /
//      p2
export function ang2d(p1:number[], p2:number[], p3:number[]):number {
  GLM.vec2.sub(toNext, p3, p2); GLM.vec2.normalize(toNext, toNext);
  GLM.vec2.sub(toPrev, p1, p2); GLM.vec2.normalize(toPrev, toPrev);
  var angToNext = Math.acos(toNext[0]);
  angToNext = toNext[1] < 0 ? PI2 - angToNext : angToNext;
  var angToPrev = Math.acos(toPrev[0]);
  angToPrev = toPrev[1] < 0 ? PI2 - angToPrev : angToPrev;
  var ang = angToNext - angToPrev;
  ang = (ang < 0 ? PI2 + ang : ang);
  return ang;
}

export function isCW(polygon:number[][]):boolean {
  var angsum = 0;
  var N = polygon.length;
  for (var i = 0; i < N; i++) {
    var curr = polygon[i];
    var prev = polygon[i == 0 ? N - 1 : i - 1];
    var next = polygon[i == N - 1 ? 0 : i + 1];
    angsum += ang2d(prev, curr, next);
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

function findOrigin(vtxs:number[][]):number[] {
  var len = vtxs.length;
  var res = [len-1, 0, 1];
  var maxlen = 0;
  var d = GLM.vec3.create();
  for (var i = 0; i < len; i++) {
    var prev = i == 0 ? len-1 : i-1;
    var next = i == len-1 ? 0 : i+1;
    var vi = vtxs[i];
    var vn = vtxs[next];

    GLM.vec3.sub(d, vi, vn);
    var dl = GLM.vec3.len(d);
    if (/*((d[0]==0 && d[1]==0)||(d[0]==0 && d[2]==0)||(d[1]==0 && d[2]==0)) &&*/ dl > maxlen) {
      maxlen = dl;
      res = [prev, i, next];
    }
  } 
  return res;
}

export function projectionSpace(vtxs:number[][]) {
  var o = findOrigin(vtxs);
  GLM.vec3.sub(a, vtxs[o[1]], vtxs[o[2]]);
  GLM.vec3.sub(b, vtxs[o[1]], vtxs[o[0]]);
  console.log(a, b);
  var n = GLM.vec3.create();
  var c = GLM.vec3.create();
  GLM.vec3.cross(n, b, a);
  GLM.vec3.normalize(n, n);
  GLM.vec3.cross(c, n, a);
  GLM.vec3.normalize(c, c);
  GLM.vec3.normalize(a, a);
  return [
    a[0], a[1], a[2],
    c[0], c[1], c[2],
    n[0], n[1], n[2]
  ];
}

export function project3d(vtxs:number[][]):number[][] {
  var mat = projectionSpace(vtxs);
  var ret = [];
  for (var i = 0; i < vtxs.length; i++) {
    var vtx = GLM.vec3.transformMat3(GLM.vec3.create(), vtxs[i], mat);
    ret.push([vtx[0], vtx[1]]);
  }
  return ret;
}

export function int2vec4(int:number) {
  return [(int&0xff), ((int>>>8)&0xff), ((int>>>16)&0xff), ((int>>>24)&0xff)];
}

export function int2vec4norm(int:number) {
  return [(int&0xff)/256, ((int>>>8)&0xff)/256, ((int>>>16)&0xff)/256, ((int>>>24)&0xff)/256];
}
