import MU = require('./libs/mathutils');
import raster = require('./modules/rasterizer');

var img = new Image();
img.src = 'resources/img/Desert_mini.jpg';

function createCanvas(w:number, h:number, tex) {
  var texProv = new raster.TexturePixelProvider(tex);

  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  document.body.appendChild(canvas);

  var buffer = [
    0, 0.5, 0, 0, 255, 255,
    0.5, 1, 0, 1, 0, 255,
    1, 0.5, 1, 1, 0, 255,

    0.5, 0, 0, 0, 255, 255,
    0.25, 0.5, 0, 1, 255, 255,
    0.75, 0.5, 1, 1, 0, 255
  ];

  var ctx = canvas.getContext('2d');
  var img = ctx.createImageData(w, h);
  var rast = new raster.Rasterizer(img, (attrs:number[]) => {
    return texProv.get(attrs[2], attrs[3]);
  });
  rast.bindAttributes(0, buffer, 6);
  rast.drawTriangles([0, 1, 2]);
  rast.drawTriangles([3, 4, 5]);
  ctx.putImageData(img, 0, 0);
}

img.onload = () => {
  createCanvas(600, 600, img);
}
