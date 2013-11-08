/// <reference path="../defs/nodeunit.d.ts"/>
define(["require", "exports", '../libs/poly2tri'], function(require, exports, __poly2tri__) {
    var poly2tri = __poly2tri__;

    function point(x, y) {
        return new poly2tri.js.poly2tri.Point(x, y);
    }

    function printTriangles(tris) {
        for (var i = 0; i < tris.length; i++) {
            var tri = tris[i];
            var str = '[' + tri.GetPoint(0).x + ' ' + tri.GetPoint(0).y + ']';
            str += '[' + tri.GetPoint(1).x + ' ' + tri.GetPoint(1).y + ']';
            str += '[' + tri.GetPoint(2).x + ' ' + tri.GetPoint(2).y + ']';
            console.log(str);
        }
    }

    function test(test) {
        var points = [];
        points.push(point(0, 0));
        points.push(point(0, 1));
        points.push(point(1, 1));
        points.push(point(1, 0));
        var hole = [];
        hole.push(point(0.2, 0.2));
        hole.push(point(0.4, 0.2));
        hole.push(point(0.4, 0.4));
        hole.push(point(0.2, 0.4));
        var ctx = new poly2tri.js.poly2tri.SweepContext(points);
        ctx.AddHole(hole);
        poly2tri.js.poly2tri.sweep.Triangulate(ctx);

        printTriangles(ctx.GetTriangles());

        test.done();
    }
    exports.test = test;
});
//# sourceMappingURL=poly2tri.js.map
