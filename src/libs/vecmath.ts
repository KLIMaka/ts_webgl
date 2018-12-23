
import GLM = require('../libs_js/glmatrix');
import pool = require('./pool');
import MU = require('./mathutils');
import vec2_t = GLM.Vec2Array;
import vec3_t = GLM.Vec3Array;
import mat2d_t = GLM.Mat2dArray;
export type vec2_t = vec2_t;
export type vec3_t = vec3_t;
export type mat2d_t = mat2d_t;

var vec2dPool = new pool.Pool<vec2_t>(100, GLM.vec2.create);
var vec3dPool = new pool.Pool<vec3_t>(100, GLM.vec3.create);

export function release2d(vec:vec2_t):void {
  vec2dPool.ret(vec);
}

export function release3d(vec:vec3_t):void {
  vec3dPool.ret(vec);
}

export function detach2d(vec:vec2_t):vec2_t {
  var ret = GLM.vec2.clone(vec);
  vec2dPool.ret(vec);
  return ret;
}

export function detach3d(vec:vec3_t):vec3_t {
  var ret = GLM.vec3.clone(vec);
  vec3dPool.ret(vec);
  return ret;
}

export function create2d():vec2_t {
  return vec2dPool.get();
}

export function fromValues2d(x:number, y:number):vec2_t {
  var vec = vec2dPool.get();
  GLM.vec2.set(vec, x, y);
  return vec;
}

export function create3d():vec3_t {
  return vec3dPool.get();
}

export function fromValues3d(x:number, y:number, z:number):vec3_t {
  var vec = vec3dPool.get();
  GLM.vec3.set(vec, x, y, z);
  return vec;
}

export function add2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.add(lh, lh, rh);
}

export function addCopy2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.add(vec2dPool.get(), lh, rh);
}

export function add3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.add(lh, lh, rh);
}

export function addCopy3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.add(vec3dPool.get(), lh, rh);
}

export function sub2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.sub(lh, lh, rh);
}

export function subCopy2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.sub(vec2dPool.get(), lh, rh);
}

export function sub3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.sub(lh, lh, rh);
}

export function subCopy3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.sub(vec3dPool.get(), lh, rh);
}

export function mul2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.mul(lh, lh, rh);
}

export function mulCopy2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.mul(vec2dPool.get(), lh, rh);
}

export function mul3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.mul(lh, lh, rh);
}

export function mulCopy3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.mul(vec3dPool.get(), lh, rh);
}

export function normalizeCopy2d(vec:vec2_t):vec2_t {
  return GLM.vec2.normalize(vec2dPool.get(), vec);
}

export function normalize2d(vec:vec2_t):vec2_t {
  return GLM.vec2.normalize(vec, vec);
}

export function normalizeCopy3d(vec:vec3_t):vec3_t {
  return GLM.vec3.normalize(vec3dPool.get(), vec);
}

export function normalize3d(vec:vec3_t):vec3_t {
  return GLM.vec3.normalize(vec, vec);
}

export function dot2d(lh:vec2_t, rh:vec2_t):number {
  return GLM.vec2.dot(lh, rh);
}

export function dot3d(lh:vec3_t, rh:vec3_t):number {
  return GLM.vec3.dot(lh, rh);
}

export function cross3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.cross(lh, lh, rh);
}

export function crossCopy3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.cross(vec3dPool.get(), lh, rh);
}

export function lerp2d(lh:vec2_t, rh:vec2_t, t:number):vec2_t {
  return GLM.vec2.lerp(lh, lh, rh, t);
}

export function lerpCopy2d(lh:vec2_t, rh:vec2_t, t:number):vec2_t {
  return GLM.vec2.lerp(vec2dPool.get(), lh, rh, t);
}

export function lerp3d(lh:vec3_t, rh:vec3_t, t:number):vec3_t {
  return GLM.vec3.lerp(lh, lh, rh, t);
}

export function lerpCopy3d(lh:vec3_t, rh:vec3_t, t:number):vec3_t {
  return GLM.vec3.lerp(vec3dPool.get(), lh, rh, t);
}

export function scale2d(vec:vec2_t, scale:number):vec2_t {
  return GLM.vec2.scale(vec, vec, scale);
}

export function len3d(vec:vec3_t):number {
  return GLM.vec3.len(vec);
}

export function intersect2d(p1s:vec2_t, p1e:vec2_t, p2s:vec2_t, p2e:vec2_t):vec2_t {
  var t = intersect2dT(p1s, p1e, p2s, p2e);
  if (t == null)
    return null;
  return lerpCopy2d(p1s, p1e, t);
}


export function intersect2dT(p1s:vec2_t, p1e:vec2_t, p2s:vec2_t, p2e:vec2_t):number {
  var d = (p1s[0]-p1e[0])*(p2s[1]-p2e[1]) - (p1s[1]-p1e[1])*(p2s[0]-p2e[0]);
  if (Math.abs(d) < MU.EPS)
    return null;
  var res0 = ((p1s[0]*p1e[1]-p1s[1]*p1e[0])*(p2s[0]-p2e[0]) - (p1s[0]-p1e[0])*(p2s[0]*p2e[1]-p2s[1]*p2e[0])) / d;
  var res1 = ((p1s[0]*p1e[1]-p1s[1]*p1e[0])*(p2s[1]-p2e[1]) - (p1s[1]-p1e[1])*(p2s[0]*p2e[1]-p2s[1]*p2e[0])) / d;

  var dx1 = p1e[0]-p1s[0];
  var dy1 = p1e[1]-p1s[1];
  var dot1 = ((res0-p1s[0])*dx1 + (res1-p1s[1])*dy1) / MU.sqrLen2d(dx1, dy1);
  if (dot1 < 0.0 || dot1 > 1.0)
    return null;
  var dx2 = p2e[0]-p2s[0];
  var dy2 = p2e[1]-p2s[1];
  var dot2 = ((res0-p2s[0])*dx2 + (res1-p2s[1])*dy2) / MU.sqrLen2d(dx2, dy2);
  if (dot2 < 0.0 || dot2 > 1.0)
    return null;

  return dot1;
}

export function direction3d(ps:vec3_t, pe:vec3_t):vec3_t {
  return normalize3d(subCopy3d(pe, ps));
}

export function direction2d(ps:vec2_t, pe:vec2_t):vec2_t {
  return normalize2d(subCopy2d(pe, ps));
}

export function projectXY(p:vec3_t):vec2_t {return fromValues2d(p[0], p[1])}
export function projectXZ(p:vec3_t):vec2_t {return fromValues2d(p[0], p[2])}
export function projectYZ(p:vec3_t):vec2_t {return fromValues2d(p[1], p[2])}

export function intersect3d(p1s:vec3_t, p1e:vec3_t, p2s:vec3_t, p2e:vec3_t):vec3_t {
  var dir1 = direction3d(p1s, p1e);
  var dir2 = direction3d(p2s, p2e);

  var p = 
    (dir1[1]*dir2[0] - dir2[1]*dir1[0]) != 0 ? projectXY :
    (dir1[0]*dir2[1] - dir2[0]*dir1[1]) != 0 ? projectXZ :
    (dir1[1]*dir2[2] - dir2[1]*dir1[2]) != 0 ? projectYZ :
    null;
  
  release3d(dir1); release3d(dir2);

  if (p == null)
    return null;
  var p1s_ = p(p1s);
  var p2s_ = p(p2s);
  var p1e_ = p(p1e);
  var p2e_ = p(p2e);
  var t = intersect2dT(p1s_, p1e_, p2s_, p2e_);
  release2d(p1s_); release2d(p2s_); release2d(p1e_); release2d(p2e_);

  if (t == null)
    return null;
  return lerpCopy3d(p1s, p1e, t);
}

export function normal2d(v1:vec2_t, v2:vec2_t):vec2_t {
  var tmp = normalize2d(subCopy2d(v2, v1));
  var norm = fromValues2d(-tmp[1], tmp[0]);
  release2d(tmp);
  return norm;
}

//
//   p1     p3
//    \ ang /
//     \ ^ /
//      \ /
//      p2
export function ang2d(p1:vec2_t, p2:vec2_t, p3:vec2_t):number {
  var toNext = subCopy2d(p3, p2); normalize2d(toNext);
  var toPrev = subCopy2d(p1, p2); normalize2d(toPrev);
  var angToNext = Math.acos(toNext[0]);
  angToNext = toNext[1] < 0 ? MU.PI2 - angToNext : angToNext;
  var angToPrev = Math.acos(toPrev[0]);
  angToPrev = toPrev[1] < 0 ? MU.PI2 - angToPrev : angToPrev;
  release2d(toNext); release2d(toPrev);
  var ang = angToNext - angToPrev;
  ang = (ang < 0 ? MU.PI2 + ang : ang);
  return ang;
}

export function isCW(polygon:vec2_t[]):boolean {
  var angsum = 0;
  var N = polygon.length;
  for (var i = 0; i < N; i++) {
    var curr = polygon[i];
    var prev = polygon[i == 0 ? N - 1 : i - 1];
    var next = polygon[i == N - 1 ? 0 : i + 1];
    angsum += ang2d(prev, curr, next);
  }
  return MU.rad2deg(angsum) == 180*(N-2);
}

export function polygonNormal(verts:vec3_t[]) {
  var a = subCopy3d(verts[1], verts[0]);
  var b = subCopy3d(verts[2], verts[0]);
  var res = normalize3d(crossCopy3d(b, a));
  release3d(a); release3d(b);
  return res;
}

export function projectionSpace(vtxs:vec3_t[], n:vec3_t) {
  var a = normalize3d(subCopy3d(vtxs[0], vtxs[1]));
  var c = normalize3d(crossCopy3d(n, a));
  var ret = [
    a[0], c[0], n[0],
    a[1], c[1], n[1],
    a[2], c[2], n[2]
  ];
  release3d(a); release3d(c); 
  return ret;
}

export function project3d(vtxs:vec3_t[], normal:vec3_t):vec2_t[] {
  var mat = projectionSpace(vtxs, normal);
  var ret = [];
  for (var i = 0; i < vtxs.length; i++) {
    var vtx = GLM.vec3.transformMat3(GLM.vec3.create(), vtxs[i], mat);
    ret.push([vtx[0], vtx[1]]);
  }
  return ret;
}

export function create2dTransform():mat2d_t {
  return GLM.mat2d.create();
}

export function scale2dTransform(mat:mat2d_t, v:vec2_t):mat2d_t {
  return GLM.mat2d.scale(mat, mat, v);
}

export function rotate2dTransform(mat:mat2d_t, rad:number):mat2d_t {
  return GLM.mat2d.rotate(mat, mat, rad);
}

export function translate2dTransform(mat:mat2d_t, v:vec2_t):mat2d_t {
  return GLM.mat2d.translate(mat, mat, v);
}

export function apply2dTransform(v:vec2_t, mat:mat2d_t):vec2_t {
  return GLM.vec2.transformMat2d(v, v, mat);
}

export function swapXY2dTransform(mat:mat2d_t):mat2d_t {
  return [mat[1], mat[0], mat[3], mat[2], mat[5], mat[4]];
}


