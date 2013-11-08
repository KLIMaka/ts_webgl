/// <reference path="../defs/nodeunit.d.ts"/>

import GLM = require('../libs/glmatrix');
import Pool = require('../libs/pool');

export function test2(test:nodeunit.Test) {
  var pool = new Pool.Pool<GLM.Vec2Array>(10, () => GLM.vec2.create());
  var v1 = GLM.vec2.set(pool.get(), 1, 2);
  var v2 = GLM.vec2.set(pool.get(), 3, 4);
  var v3 = GLM.vec2.lerp(pool.get(), v1, v2, 0.5);

  test.equal(v3[0], 2);
  test.equal(v3[1], 3);
  pool.ret(v3, v2, v1);

  test.done();
}
