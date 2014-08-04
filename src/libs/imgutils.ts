
import pixel = require('../modules/pixelprovider');

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

export function clearCanvas(canvas:HTMLCanvasElement, style:string) {
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = style;
  ctx.fillRect(0,0,canvas.width,canvas.height);
}