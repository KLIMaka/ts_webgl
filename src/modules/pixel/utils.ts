
export interface ColorComparator {
  (r1:number, g1:number, b1:number, r2:number, g2:number, b2:number):number;
}

export function euclidean_len(r1:number, g1:number, b1:number, r2:number, g2:number, b2:number):number {
  return Math.abs(Math.sqrt(r1*r1+g1*g1+b1*b1) - Math.sqrt(r2*r2+g2*g2+b2*b2));
}

export function matchColor(r:number, g:number, b:number, pal:Uint8Array, len:ColorComparator=euclidean_len):number {
  var matched = 0;
  var minLen = len(r,g,b,pal[0],pal[1],pal[2]);
  var colors = pal.length;
  for (var i = 3; i < colors; i+=3) {
    var l = len(r,g,b,pal[i],pal[i+1],pal[i+2]);
    if (l < minLen) {
      matched = i/3;
      minLen = l;
    }
  }
  return matched;
}

export function matchRGBAImage(img:Uint8Array, pal:Uint8Array, len:ColorComparator=euclidean_len):Uint8Array {
  var size = img.length/4;
  var indexed = new Uint8Array(size);
  for (var i = 0; i < size; i++) {
    var off = i * 4;
    indexed[i] = matchColor(img[off], img[off+1], img[off+2], pal, len);
  }
  return indexed;
}

export function print(x:number, y:number, wdst:number, w:number, buf:Uint8Array, data:Uint8Array) {
  var off = y*wdst+x;
  var len = data.length;
  var line = 0;
  for (var i = 0; i < len; i++, line++, off++) {
    if (line == w) {
      off += wdst - line;
      line = 0;
    }
    buf[off] = data[i];
  }
}

export function string2bytes(str:string):Uint8Array {
  var len = str.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++)
    bytes[i] = str.charCodeAt(i);
  return bytes;
}

export function printString(x:number, y:number, wdst:number, w:number, buf:Uint8Array, str:string) {
  print(x, y, wdst, w, buf, string2bytes(str));
}