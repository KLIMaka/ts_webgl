
export function rgb2hsl(r:number, g:number, b:number):number[] {
  // convert RGB to HSV
  var rd = r / 255.0;            // rd,gd,bd range 0-1 instead of 0-255
  var gd = g / 255.0;
  var bd = b / 255.0;

  var max = Math.max(rd, gd, bd);
  var min = Math.min(rd, gd, bd);
  var l = (max+min) / 2.0;
  var delta = max-min;
  var s = 0;
  var h = 0;
  if(max != min) {
    s = delta / (1-Math.abs(2*l-1));
    if (max == rd) h = 42.5 * (gd-bd)/(delta);
    else if (max == gd)  h = 42.5 * ((bd-rd)/(delta)+2);
    else h = 42.5 * ((rd-gd)/(delta)+4);
    if (h < 0) h += 255;
  }
  return [h|0, (s*255)|0, (l*255)|0];
}

export function hsl2rgb(h:number, s:number, l:number):number[] {
  if(s == 0) 
    return [l, l, l];

  var hf = h / 255.0;
  var lf = l / 255.0;
  var sf = s / 255.0;

  var c = (1-Math.abs(2*lf-1))*sf;
  var x = c*(1-Math.abs((h/42.5)%2-1));
  var m = lf-c/2;

  var r,g,b;
  if (h >= 0 && h < 42.5) { r = c; g = x; b = 0; } 
  else if (h >= 42.5 && h <= 42.5*2) { r = x; g = c; b = 0; }
  else if (h >= 42.5*2 && h <= 42.5*3) { r = 0; g = c; b = x; }
  else if (h >= 42.5*3 && h <= 42.5*4) { r = 0; g = x; b = c; }
  else if (h >= 42.5*4 && h <= 42.5*5) { r = x; g = 0; b = c; }
  else if (h >= 42.5*5 && h <= 42.5*6) { r = c; g = 0; b = x; }

  return [((r+m)*255)|0, ((g+m)*255)|0, ((b+m)*255)|0];
}

export function rgb2xyz(r:number, g:number, b:number):number[] {
  return [
    (r*0.49 + g*0.31 + b*0.2)/0.17697,
    (r*0.17697 + g*0.8124 + b*0.01063)/0.17697,
    (r*0 + g*0.01 + b*0.99)/0.17697
  ];
}

export function xyz2rgb(x:number, y:number, z:number):number[] {
  return [
    x*0.41847 + y*-0.15866 + z*-0.082835,
    x*-0.091169 + y*0.25243 + z*0.015708,
    x*0.00092090 + y*-0.0025498 + z*0.1786
  ];
}

var xn = 95.047;
var yn = 100;
var zn = 108.883;
export function xyz2lab(x:number, y:number, z:number):number[] {
  return [
    116*f(y/yn) - 16,
    500*(f(x/xn) - f(y/yn)),
    200*(f(y/yn) - f(z/zn))
  ]
}

var c = Math.pow(6/29, 3);
function f(t:number):number {
  if (t > c) return Math.pow(t, 1/3);
  else return (1/3)*Math.pow(29/6,2)*t+4/29;
}

export function convertPal(srcPal:number[], conv:(a:number, b:number, c:number)=>number[]):number[] {
  var dst = new Array<number>(256*3);
  for (var i = 0; i < 256; i++) {
    var off = i*3;
    var r = conv(srcPal[off+0], srcPal[off+1], srcPal[off+2]);
    dst[off+0] = r[0];
    dst[off+1] = r[1];
    dst[off+2] = r[2];
  }
  return dst;
}

export function findHsl(pal:number[], h:number, s:number, l:number):number[] {
  var mindist = Number.MAX_VALUE;
  var mindist1 = Number.MAX_VALUE;
  var idx = 0;
  var idx1 = 0;
  for (var i = 0; i < 256; i++) {
    var off = i*3;
    var dh = h-pal[off+0];
    var ds = s-pal[off+1];
    var dl = l-pal[off+2];
    var dist = Math.sqrt(dh*dh+ds*ds+dl*dl);
    if (dist < mindist) {
      mindist1 = mindist;
      idx1 = idx;
      mindist = dist;
      idx = i;
    }
  }
  return [idx, idx1, mindist/mindist1];
}

var ditherMatrix = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21];

export function dither(x:number, y:number, t:number):boolean {
  if (t == 0.0) return true;
  if (t == 1.0) return false;
  var idx = (y%8)*8+x%8;
  var d = (ditherMatrix[idx]+1) / 64;
  return t <= d;
}