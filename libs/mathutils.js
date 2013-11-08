define(["require", "exports"], function(require, exports) {
    

    var radsInDeg = 180 / Math.PI;
    var degInRad = Math.PI / 180;

    function deg2rad(deg) {
        return deg * degInRad;
    }
    exports.deg2rad = deg2rad;

    function rad2deg(rad) {
        return rad * radsInDeg;
    }
    exports.rad2deg = rad2deg;

    function mat3FromMat4(out, a) {
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
    exports.mat3FromMat4 = mat3FromMat4;
});
