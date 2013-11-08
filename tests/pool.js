/// <reference path="../defs/nodeunit.d.ts"/>
define(["require", "exports", '../libs/glmatrix', '../libs/pool'], function(require, exports, __GLM__, __Pool__) {
    var GLM = __GLM__;
    var Pool = __Pool__;

    function test2(test) {
        var pool = new Pool.Pool(10, function () {
            return GLM.vec2.create();
        });
        var v1 = GLM.vec2.set(pool.get(), 1, 2);
        var v2 = GLM.vec2.set(pool.get(), 3, 4);
        var v3 = GLM.vec2.lerp(pool.get(), v1, v2, 0.5);

        test.equal(v3[0], 2);
        test.equal(v3[1], 3);
        pool.ret(v3, v2, v1);

        test.done();
    }
    exports.test2 = test2;
});
//# sourceMappingURL=pool.js.map
