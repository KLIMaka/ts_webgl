
import GLM = require('../libs_js/glmatrix');
import pool = require('pool');
import vec2_t = GLM.Vec2Array;
import vec3_t = GLM.Vec3Array;

var vec2dPool = new pool.Pool<vec2_t>(100, GLM.vec2.create);
var vec3dPool = new pool.Pool<vec3_t>(100, GLM.vec3.create);

export function release2d(...vecs:vec2_t):void {
  vec2dPool.ret(vecs);
}

export function release3d(...vecs:vec3_t):void {
  vec3dPool.ret(vecs);
}

export function detach2d(vec:vec2_t):void {
  var ret = GLM.vec2.clone(vec);
  vec2dPool.ret(vec);
  retyrn ret;
}

export function detach3d(vec:vec3_t):void {
  var ret = GLM.vec3.clone(vec);
  vec3dPool.ret(vec);
  retyrn ret;
}

export function create2d():vec2_t {
  return vec2dPool.get();
}

export function create3d():vec3_t {
  return vec3dPool.get();
}

export function add2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.add(vec2dPool.get(), lh, rh);
}

export function add3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.add(vec3dPool.get(), lh, rh);
}

export function sub2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.sub(vec2dPool.get(), lh, rh);
}

export function sub3d(lh:vec3_t, rh:vec3_t):vec3_t {
  return GLM.vec3.sub(vec3dPool.get(), lh, rh);
}

export function mul2d(lh:vec2_t, rh:vec2_t):vec2_t {
  return GLM.vec2.mul(vec2dPool.get(), lh, rh);
}

export function mul3d(lh:vec3_t, rh:vec3_t):vec3_t {
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

export function normalize2d(vec:vec3_t):vec3_t {
  return GLM.vec3.normalize(vec, vec);
}
