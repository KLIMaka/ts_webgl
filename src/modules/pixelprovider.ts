
import MU = require('../lib/mathutils');

export interface PixelProvider {
  getPixel(x:number, y:number):number[];
  putToDst(x:number, y:number, dst:number[], dstoff:number):void;
  getWidth():number;
  getHeight():number;    
}

export class AbstractPixelProvider implements PixelProvider {

  constructor(private w:number, private h:number) {
    if (w <= 0 || h <= 0)
      throw new Error('Invalid size');
  }

  public putToDst(x:number, y:number, dst:number[], dstoff:number):number[] {}

  public getPixel(x:number, y:number):number[] {
    var dst = new Array<number>(4);
    this.putToDst(x, y, dst, 0);
    return dst;
  }

  getWidth():number {
    return this.w;
  }

  getHeight():number {
    return this.h;
  }
}

export class RGBAArrayPixelProvider extends AbstractPixelProvider {

  constructor(private arr:Uint8Array, w:number, h:number) {
    super(w, h);
    if (arr.length != w*h*4)
      throw new Error('Invalid array size');
  }

  public putToDst(x:number, y:number, dst:number[], dstoff:number):number[] {
    dst[dstoff] = this.arr[x+y*this.w];
    dst[dstoff+1] = this.arr[x+y*this.w+1];
    dst[dstoff+2] = this.arr[x+y*this.w+2];
    dst[dstoff+3] = this.arr[x+y*this.w+3];
  }
}

export class RGBPalPixelProvider extends AbstractPixelProvider {

  constructor(private arr:Uint8Array, private pal:Uint8Array, w:number, h:number, private alpha:number=255) {
    super(w, h);
    if (arr.length != w*h)
      throw new Error('Invalid array size');
  }

  public putToDst(x:number, y:number, dst:number[], dstoff:number):number[] {
    var palidx = this.arr[x+y*this.w];
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
    super(ex-sy, ey-sy);
    this.origw = provider.getWidth();
    this.origh = provider.getHeight();
    if (sx >= ex || sy >= ey)
      throw new Error('Invalid subrect');
  }

  public putToDst(x:number, y:number, dst:number[], dstoff:number):number[] {
    var nx = sx+x;
    var ny = sy+y;
    if (nx < 0 || ny < 0 || nx >= this.origw || ny >= this.origh)
      this.putPadding(dst, dstoff);
    else
      this.provider.putToDst(nx, ny, dst, dstoff);
  }

  private putPadding(dst:number[], dstoff:number) {
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

  public putToDst(x:number, y:number, dst:number[], dstoff:number):number[] {
    this.provider.putToDst(MU.int(x*this.dx), MU.int(y*this.dy), dst, dstoff);
  }
}

export function rect(provider:PixelProvider, w:number, h:number, paddColod:number[]=[0,0,0,0]) {
  if (provider.getHeight() == h && provider.getWidth() == w)
    return provider;
  return new RectPixelProvider(provider, w, h);
}

export function resize(provider:PixelProvider, w:number, h:number) {
  if (provider.getHeight() == h && provider.getWidth() == w)
    return provider;
  return new ResizePixelProvider(provider, w, h);
}

export function fit(w:number, h:number, provider:PixelProvider, paddColod:number[]=[0,0,0,0]) {
  if (provider.getHeight() == h && provider.getWidth() == w)
    return provider;
  if (provider.getWidth() <= w && provider.getHeight() <= h) {
    return rect(provider, w, h, paddColor);
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
    if (r)
      return rect(resize(provider, nw, nh), w, h, paddColor);
    else
      return resize(provider, w, h);
  }
}
