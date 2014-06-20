
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
  var id = ctx.getImageData(x, y, provider.getWidth(), provider.getHeight());
  provider.render(id.data);
  ctx.putImageData(id, x, y);
}