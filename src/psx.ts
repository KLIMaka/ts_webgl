import IU = require('./libs/imgutils');
import MU = require('./libs/mathutils');
import pixel = require('./modules/pixelprovider');
import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import AB = require('./libs/asyncbarrier');

var ab = AB.create((results) => start(results));
getter.preload('resources/psx/vram1.bin', ab.callback('vram'));
ab.wait();

class PSX16PixelProvider extends pixel.AbstractPixelProvider {

  constructor(private arr:Uint16Array) {
    super(1024, 512);
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var w = this.getWidth();
    var pixel = this.arr[x+y*w];
    dst[dstoff+0] = (pixel & 0x1f) << 3;
    dst[dstoff+1] = ((pixel >> 5) & 0x1f) << 3;
    dst[dstoff+2] = ((pixel >> 10) & 0x1f) << 3;
    dst[dstoff+3] = 255;
  }
}

class PSX8PixelProvider extends pixel.AbstractPixelProvider {

  constructor(private arr:Uint8Array) {
    super(2048, 512);
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var w = this.getWidth();
    var pixel = this.arr[x+y*w];
    dst[dstoff+0] = pixel;
    dst[dstoff+1] = pixel;
    dst[dstoff+2] = pixel;
    dst[dstoff+3] = 255;
  }
}

class PSX4PixelProvider extends pixel.AbstractPixelProvider {

  constructor(private arr:Uint8Array) {
    super(4096, 512);
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var pixel = this.arr[MU.int(x/2)+y*2048];
    pixel = x % 2 == 1 ? ((pixel >> 4) & 0xf) : pixel & 0xf; 
    dst[dstoff+0] = pixel << 4;
    dst[dstoff+1] = pixel << 4;
    dst[dstoff+2] = pixel << 4;
    dst[dstoff+3] = 255;
  }
}


function start(res) {
  var vram16 = new Uint16Array(res.vram.slice(0x2733DF), 0, 1024*512);
  var vram8 = new Uint8Array(res.vram.slice(0x2733DF), 0, 1024*1024);
  var pp16 = new PSX16PixelProvider(vram16);
  var pp8 = new PSX8PixelProvider(vram8);
  var pp4 = new PSX4PixelProvider(vram8);
  document.body.appendChild(IU.createCanvas(pp16));
  document.body.appendChild(IU.createCanvas(pp8));
  document.body.appendChild(IU.createCanvas(pp4));

  document.onclick = (e:MouseEvent) => {
    console.log(e.x, e.y);
  };

  var px = vram16[174*1024+33];
  vram16.forEach((value, index, arr) => {
    if (value == px)
       console.log(index);
  })

  var len = 160;
  var off = 0x80500;
  while (len != 0) {
    console.log(vram8[off + 160 - len--].toString(16));
  }
}
