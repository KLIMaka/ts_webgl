
import MU = require('../libs/mathutils');

export interface PixelProvider {
  getPixel(x:number, y:number):Uint8Array;
  putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void;
  getWidth():number;
  getHeight():number;
  render(dst:Uint8Array):void;
}

export class AbstractPixelProvider implements PixelProvider {

  constructor(private w:number, private h:number) {
    if (w <= 0 || h <= 0)
      throw new Error('Invalid size');
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {}

  public getPixel(x:number, y:number):Uint8Array {
    var dst = new Uint8Array(4);
    this.putToDst(x, y, dst, 0);
    return dst;
  }

  getWidth():number {
    return this.w;
  }

  getHeight():number {
    return this.h;
  }

  render(dst:Uint8Array):void {
    var off = 0;
    for (var y = 0; y < this.h; y++) {
      for (var x = 0; x < this.w; x++){
        this.putToDst(x, y, dst, off);
        off+=4
      }
    }
  }
}

export class RGBAArrayPixelProvider extends AbstractPixelProvider {

  constructor(private arr:Uint8Array, w:number, h:number) {
    super(w, h);
    if (arr.length != w*h*4)
      throw new Error('Invalid array size');
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var w = this.getWidth();
    dst[dstoff] = this.arr[x+y*w];
    dst[dstoff+1] = this.arr[x+y*w+1];
    dst[dstoff+2] = this.arr[x+y*w+2];
    dst[dstoff+3] = this.arr[x+y*w+3];
  }
}

export class RGBPalPixelProvider extends AbstractPixelProvider {

  constructor(private arr:Uint8Array, private pal:number[], w:number, h:number, private alpha:number=255) {
    super(w, h);
    if (arr.length != w*h)
      throw new Error('Invalid array size');
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var w = this.getWidth();
    var palidx = this.arr[x+y*w]*3;
    dst[dstoff] = this.pal[palidx];
    dst[dstoff+1] = this.pal[palidx+1];
    dst[dstoff+2] = this.pal[palidx+2];
    dst[dstoff+3] = this.alpha;
  }
}

export class RectPixelProvider extends AbstractPixelProvider {

  private origw:number;
  private origh:number;

  constructor(private provider:PixelProvider, private sx:number, private sy:number, private ex:number, private ey:number, private paddColor:number[]=[0,0,0,0]) {
    super(ex-sx, ey-sy);
    this.origw = provider.getWidth();
    this.origh = provider.getHeight();
    if (sx >= ex || sy >= ey)
      throw new Error('Invalid subrect');
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var nx = this.sx+x;
    var ny = this.sy+y;
    if (nx < 0 || ny < 0 || nx >= this.origw || ny >= this.origh)
      this.putPadding(dst, dstoff);
    else
      this.provider.putToDst(nx, ny, dst, dstoff);
  }

  private putPadding(dst:Uint8Array, dstoff:number) {
    dst[dstoff] = this.paddColor[0];
    dst[dstoff+1] = this.paddColor[1];
    dst[dstoff+2] = this.paddColor[2];
    dst[dstoff+3] = this.paddColor[3];
  }
}

export class ResizePixelProvider extends AbstractPixelProvider {

  private dx:number;
  private dy:number;

  constructor(private provider:PixelProvider, w:number, h:number) {
      super(w ,h);
      this.dx = provider.getWidth() / w;
      this.dy = provider.getHeight() / h;
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    this.provider.putToDst(MU.int(x*this.dx), MU.int(y*this.dy), dst, dstoff);
  }
}

export class AxisSwapPixelProvider extends AbstractPixelProvider {

  constructor(private provider:PixelProvider) {
    super(provider.getHeight() ,provider.getWidth());
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    this.provider.putToDst(y, x, dst, dstoff);
  }
}

export function axisSwap(provider:PixelProvider) {
  return new AxisSwapPixelProvider(provider);
}

export function rect(provider:PixelProvider, sx:number, sy:number, ex:number, ey:number, paddColod:number[]=[0,0,0,0]) {
  if (sx == 0 && sy == 0 && provider.getHeight() == ey && provider.getWidth() == ex)
    return provider;
  return new RectPixelProvider(provider, sx, sy, ex, ey, paddColod);
}

export function resize(provider:PixelProvider, w:number, h:number) {
  if (provider.getHeight() == h && provider.getWidth() == w)
    return provider;
  return new ResizePixelProvider(provider, w, h);
}

export function fit(w:number, h:number, provider:PixelProvider, paddColor:number[]=[0,0,0,0]) {
  if (provider.getHeight() == h && provider.getWidth() == w)
    return provider;
  if (provider.getWidth() <= w && provider.getHeight() <= h) {
    var sx = (provider.getWidth() - w) / 2;
    var sy = (provider.getHeight() - h) / 2;
    return rect(provider, sx, sy, w+sx, h+sy, paddColor);
  } else {
    var aspect = provider.getWidth() / provider.getHeight();
    var nw = provider.getWidth();
    var nh = provider.getHeight();
    var r = false;
    if (nw > w) {
      nw = w;
      nh = nw / aspect;
      r = true;
    }
    if (nh > h) {
      nh = h;
      nw = nw * aspect;
      r = true;
    }
    if (r) {
      var sx = (nw - w) / 2;
      var sy = (nh - h) / 2;
      return rect(resize(provider, nw, nh), sx, sy, w+sx, h+sy, paddColor);
    } else {
      return resize(provider, w, h);
    }
  }
}