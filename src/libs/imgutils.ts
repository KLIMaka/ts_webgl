
import pixel = require('../modules/pixelprovider');

export function createEmptyCanvas(width:number, height:number):HTMLCanvasElement {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createCanvas(provider:pixel.PixelProvider):HTMLCanvasElement {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = provider.getWidth();
  canvas.height = provider.getHeight();
  drawToCanvas(provider, canvas);
  return canvas;
}

export function drawToCanvas(provider:pixel.PixelProvider, canvas:HTMLCanvasElement, x:number=0, y:number=0) {
  var ctx = canvas.getContext('2d');
  var id = ctx.createImageData(provider.getWidth(), provider.getHeight());
  provider.render(id.data);
  ctx.putImageData(id, x, y);
}

export function blendToCanvas(provider:pixel.PixelProvider, canvas:HTMLCanvasElement, x:number=0, y:number=0) {
  var ctx = canvas.getContext('2d');
  var id = ctx.getImageData(x ,y, provider.getWidth(), provider.getHeight());
  provider.blend(id.data);
  ctx.putImageData(id, x, y);
}

export function clearCanvas(canvas:HTMLCanvasElement, style:string) {
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = style;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}

export function copyRGBA(src:Uint8Array, srcoff:number, dst:Uint8Array, dstoff:number) {
  dst[dstoff] = src[srcoff];
  dst[dstoff+1] = src[srcoff+1];
  dst[dstoff+2] = src[srcoff+2];
  dst[dstoff+3] = src[srcoff+3];
}

export function blendRGBA(src:Uint8Array, srcoff:number, dst:Uint8Array, dstoff:number) {
  if (src[srcoff+3] == 0)
    return;
  var t = src[srcoff+3]/255;
  var t_ = 1-t;
  dst[dstoff+0] = dst[dstoff+0]*t_ + src[srcoff+0]*t;
  dst[dstoff+1] = dst[dstoff+1]*t_ + src[srcoff+1]*t;
  dst[dstoff+2] = dst[dstoff+2]*t_ + src[srcoff+2]*t;
  dst[dstoff+3] = Math.max(dst[dstoff+3], src[srcoff+3]);
}
