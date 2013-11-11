
import GLM = require('../libs_js/glmatrix.d');

var radsInDeg = 180 / Math.PI;
var degInRad = Math.PI / 180;

export function deg2rad(deg:number):number {
  return deg * degInRad;
}

export function rad2deg(rad:number):number {
  return rad * radsInDeg;
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
