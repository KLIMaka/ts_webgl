import MU = require('../../libs/mathutils');

export type PutFunc = (x:number, y:number) => void;

export function line(put:PutFunc, x1:number, y1:number, x2:number, y2:number):void {
  var dx = Math.abs(x2-x1);
  var sx = x1<x2 ? 1 : -1;
  var dy =Math.abs(y2-y1);
  var sy = y1<y2 ? 1 : -1; 
  var err = (dx>dy ? dx : -dy)/2
  var e2 = 0;
 
  for(;;){
    put(x1, y1);
    if (x1==x2 && y1==y2) break;
    e2 = err;
    if (e2 >-dx) { err -= dy; x1 += sx; }
    if (e2 < dy) { err += dx; y1 += sy; }
  }
}

export function rect(put:PutFunc, x:number, y:number, w:number, h:number):void {
  if (w < 0) { x += w; w = -w; }
  if (h < 0) { y += h; h = -h; }
  line(put, x, y, x+w, y);
  line(put, x, y+h, x+w, y+h);
  line(put, x, y+1, x, y+h-1);
  line(put, x+w, y+1, x+w, y+h-1);
}

export function circle(put:PutFunc, x0:number, y0:number, r:number, k:number=1):void {
  var x = r;
  var y = 0;
  var err = 0;

  while (x >= y) {
    put(x0 + x, y0 + y);
    put(x0 + y, y0 + x);
    put(x0 - y, y0 + x);
    put(x0 - x, y0 + y);
    put(x0 - x, y0 - y);
    put(x0 - y, y0 - x);
    put(x0 + y, y0 - x);
    put(x0 + x, y0 - y);

    y += 1;
    err += 1 + 2*y;
    if (2*(err-x)+k > 0) {
      x -= 1;
      err += 1 - 2*x;
    }
  }
}