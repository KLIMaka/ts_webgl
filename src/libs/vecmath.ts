
import GLM = require('../libs_js/glmatrix');
import pool = require('./pool');
import vec2_t = GLM.Vec2Array;
import vec3_t = GLM.Vec3Array;

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

export function lerp2d(lh:vec2_t, rh:vec2_t, t:number):vec2_t {
  return GLM.vec2.lerp(lh, lh, rh, t);
}

export function lerpCopy2d(lh:vec2_t, rh:vec2_t, t:number):vec2_t {
  return GLM.vec2.lerp(vec2dPool.get(), lh, rh, t);
}

export function scale2d(vec:vec2_t, scale:number):vec2_t {
  return GLM.vec2.scale(vec, vec, scale);
}
