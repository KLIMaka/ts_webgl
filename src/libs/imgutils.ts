import * as pixel from '../modules/pixelprovider';

export function createEmptyCanvas(width: number, height: number): HTMLCanvasElement {
  var canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function createCanvas(provider: pixel.PixelProvider, blend: pixel.BlendFunc = pixel.BlendNormal): HTMLCanvasElement {
  var canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = provider.getWidth();
  canvas.height = provider.getHeight();
  drawToCanvas(provider, canvas, 0, 0, blend);
  return canvas;
}

export function drawToCanvas(provider: pixel.PixelProvider, canvas: HTMLCanvasElement, x: number = 0, y: number = 0, blend: pixel.BlendFunc = pixel.BlendNormal) {
  var ctx = canvas.getContext('2d');
  var data: Uint8ClampedArray;
  if (blend === pixel.BlendNormal) {
    data = new Uint8ClampedArray(provider.getWidth() * provider.getHeight() * 4);
    var id = new ImageData(data, provider.getWidth(), provider.getHeight());
  }
  provider.render(data, blend);
  ctx.putImageData(id, x, y);
}

export function clearCanvas(canvas: HTMLCanvasElement, style: string) {
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = style;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function loadImageFromBuffer(buff: ArrayBuffer, cb: (provider: pixel.PixelProvider) => void): void {
  var blob = new Blob([buff]);
  var urlCreator = window.URL;
  var imageUrl = urlCreator.createObjectURL(blob);
  var img = new Image();
  img.src = imageUrl;
  img.onload = (evt) => {
    var img = <HTMLImageElement>evt.target;
    var canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    var data = new Uint8Array(ctx.getImageData(0, 0, img.width, img.height).data);
    cb(new pixel.RGBAArrayPixelProvider(data, img.width, img.height));
  }
}

export async function loadImage(name: string): Promise<[number, number, Uint8Array]> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = name;
    image.onload = (evt) => {
      const img = <HTMLImageElement>evt.target;
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve([img.width, img.height, new Uint8Array(ctx.getImageData(0, 0, img.width, img.height).data)]);
    }
  });
}
