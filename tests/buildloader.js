/// <reference path="../defs/nodeunit.d.ts"/>
define(["require", "exports", '../modules/buildloader'], function(require, exports, __build__) {
    var build = __build__;

    function build_test(test) {
        var board = build.loadBuildMap('./newboard.map');
        console.log(board);
        //  test.done();
    }
    exports.build_test = build_test;
});
//# sourceMappingURL=buildloader.js.map
