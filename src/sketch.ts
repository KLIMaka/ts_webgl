import GL = require('./modules/gl');
import TEX = require('./modules/textures');
import MU = require('./libs/mathutils');
import CTRL = require('./modules/controller2d');
import GLM = require('./libs_js/glmatrix');
import BATCHER = require('./modules/batcher');
import SHADERS = require('./modules/shaders');
import MB = require('./modules/meshbuilder');
import UI = require('./modules/ui/ui');
import CANV = require('./modules/pixel/canvas');
import IU = require('./libs/imgutils');
import FR = require('./modules/ui/filereader');
import P = require('./modules/pixelprovider');
import COLOR = require('./modules/color');
import GRP = require('./modules/engines/build/grp');
import ART = require('./modules/engines/build/art');
import RFF = require('./modules/engines/build/rff');
import pixel = require('./modules/pixelprovider');
import getter = require('./libs/getter');

var pal = new Uint8Array(256*3);
// pal[0] = 0;   pal[1] =   0; pal[2] =   0;
// pal[3] = 62;  pal[4] =  49; pal[5] = 162;
// pal[6] = 87;  pal[7] =  66; pal[8] =   0;
// pal[9] = 140; pal[10] =  62; pal[11] =  52;
// pal[12] = 84;  pal[13] =  84; pal[14] =  84;
// pal[15] = 141; pal[16] =  72; pal[17] = 179;
// pal[18] = 144; pal[19] =  95; pal[20] =  37;
// pal[21] = 124; pal[22] = 112; pal[23] = 218;
// pal[24] = 128; pal[25] = 128; pal[26] = 128;
// pal[27] = 104; pal[28] = 169; pal[29] =  65;
// pal[30] = 187; pal[31] = 119; pal[32] = 109;
// pal[33] = 122; pal[34] = 191; pal[35] = 199;
// pal[36] = 171; pal[37] = 171; pal[38] = 171;
// pal[39] = 208; pal[40] = 220; pal[41] = 113;
// pal[42] = 172; pal[43] = 234; pal[44] = 136;
// pal[45] = 255; pal[46] = 255; pal[47] = 255;

var dither4 = [
39, 40, 41, 42, 43, 44, 45, 46, 
38, 18, 19, 20, 21, 22, 23, 47, 
37, 17,  5,  6,  7,  8, 24, 48, 
36, 16,  4,  0,  1,  9, 25, 49, 
63, 35, 15,  3,  2, 10, 26, 50, 
62, 34, 14, 13, 12, 11, 27, 51, 
61, 33, 32, 31, 30, 29, 28, 52, 
60, 59, 58, 57, 56, 55, 54, 53, 
];

var dither3 = [
0, 1, 2, 3,
8, 9, 10, 11,
4, 5, 6, 7,
12, 13, 14, 15,
]; 

var dither1 = [
0, 8, 4, 12,
1, 9, 5, 13,
2, 10, 6, 14,
3, 11, 7, 15,
];

var dither2 = [
0, 32, 8, 40, 2, 34, 10, 42,
48, 16, 56, 24, 50, 18, 58, 26,
12, 44, 4, 36, 14, 46, 6, 38,
60, 28, 52, 20, 62, 30, 54, 22,
3, 35, 11, 43, 1, 33, 9, 41,
51, 19, 59, 27, 49, 17, 57, 25,
15, 47, 7, 39, 13, 45, 5, 37,
63, 31, 55, 23, 61, 29, 53, 21];

var ditherTri = [
0, 1, 5, 6, 14, 15, 27, 28,
2, 4, 7, 13, 16, 26, 29, 42,
3, 8, 12, 17, 25, 30, 41, 43,
9, 11, 18, 24, 31, 40, 44, 53,
10, 19, 23, 32, 39, 45, 52, 54,
20, 22, 33, 38, 46, 51, 55, 60,
21, 34, 37, 47, 50, 56, 59, 61,
35, 36, 48, 49, 57, 58, 62, 63,
]

var dither111 = [
0,8,4,14,
11,1,9,5,
6,12,2,10,
15,7,13,3,
];

var ditherSpir = [
36,37,38,39,40,41,42,
35,6,7,8,9,10,43,
34,5,22,23,24,11,44,
33,4,21,0,25,12,45,
32,3,2,1,26,13,46,
31,30,29,28,27,14,47,
20,19,18,17,16,15,48,
];

var ditherFan = [
42,44,48, 3, 7,13,16, 
38,41,47, 2,10,15,19, 
32,35,36, 1, 9,21,23, 
30,29,28, 0,25,26,27, 
24,22,11, 4,33,34,31, 
20,17,12, 5,45,39,37, 
18,14, 8, 6,46,43,40, 
];

var dithStar = [
24,43,47, 9,29,36,21,
39,20, 0, 5,25,17,40,
32,28,16, 1,13,33,44,
12, 8, 4, 0, 2, 6,10,
46,35,15, 3,14,26,30,
42,19,27, 7,34,18,37,
23,38,31,11,45,41,22,
];

function triangle(s:number):number[] {
  var arr = new Array<number>(s*s);
  var c = 0;
  for (var d = 0; d < s; d++) {
    for (var i = 0; i <= d; i++) {
      var y = i;
      var x = d - i;
      arr[y*s+x] = c++;
    }
  }
  for (var d = 1; d < s; d++) {
    for (var i = 0; i <= s-d; i++) {
      var y = i;
      var x = d - i;
      arr[y*s+x] = c++;
    }
  }
  return arr;
}

class ConverterPixelProvider extends P.AbstractPixelProvider {
  private labPal:number[];
  private palTmp = new Uint8Array([0,0,0,255]);

  constructor(private provider:P.PixelProvider, private pal:number[], private dim:number) {
    super(provider.getWidth(), provider.getHeight());
    var xyzPal = COLOR.convertPal(pal, COLOR.rgb2xyz);
    this.labPal = COLOR.convertPal(xyzPal, COLOR.xyz2lab);
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number, blend:P.BlendFunc):void {
    this.provider.putToDst(x, y, dst, dstoff, blend);
    // var xyz = COLOR.rgb2xyz(dst[dstoff+0],dst[dstoff+1],dst[dstoff+2]);
    // var lab = COLOR.xyz2lab(xyz[0], xyz[1], xyz[2]);
    // var [i, i1, t] = COLOR.findHsl(this.labPal, lab[0], lab[1], lab[2]);
    var t = COLOR.rgb2lum(dst[dstoff+0], dst[dstoff+1], dst[dstoff+2]) / 255;
    t *= this.dim;
    var min = t <= 0.5 ? 0 : 0.5; 
    var max = t <= 0.5 ? 0.5 : 1; 
    // var idx = COLOR.dither(x, y, t, dither1) ? i : i1;
    // this.palTmp[0] = this.pal[idx*3+0];
    // this.palTmp[1] = this.pal[idx*3+1];
    // this.palTmp[2] = this.pal[idx*3+2];
    var col =  COLOR.dither(x, y, (t-min)*2, dithStar) ? min*255 : max*255;
    this.palTmp[0] = col;
    this.palTmp[1] = col;
    this.palTmp[2] = col;
    blend(dst, dstoff, this.palTmp, 0);
  }
}

class MyPixelProvider extends P.AbstractPixelProvider {
  private arr:Uint8Array;
  private colTmp = new Uint8Array([0,0,0,255]);

  constructor(private buff:ArrayBuffer) {
    super(16,16*32);
    this.arr = new Uint16Array(buff);
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number, blend:P.BlendFunc):void {
    var idx = x+y*16;
    var col = this.arr[idx];
    this.colTmp[2] = (col & 0x1f) << 3;
    this.colTmp[1] = ((col >> 5) & 0x3f) << 2;
    this.colTmp[0] = ((col >> 11) & 0x1f) << 3;
    blend(dst, dstoff, this.colTmp, 0);
  }
}

getter.loader
.load('resources/engines/duke/duke3d.grp')
.finish(() => {

var file = getter.get('resources/engines/duke/duke3d.grp');
var grpFile = GRP.create(file);
// var pal = GRP.createPalette(grpFile.get('PALETTE.DAT'));
var pal1 = new Array<number>(256*3);
for (var i = 0; i < 256*3; i++) pal1[i] = pal[i];

new FR.DropFileReader(
  document.getElementById('loader'),
  (f:File) => { return true },
  (buff:ArrayBuffer) => { processFile(buff, pal1) }
);

});

function processFile1(buff:ArrayBuffer, pal:number[]) {
  var provider = new MyPixelProvider(buff);
  var canvas = IU.createCanvas(provider);
  document.body.appendChild(canvas);
}

function processFile(buff:ArrayBuffer, pal:number[]) {
  IU.loadImageFromBuffer(buff, (provider:P.PixelProvider) => {
    var canvas = IU.createEmptyCanvas(provider.getWidth(), provider.getHeight());
    document.body.appendChild(canvas);

    // var time = new Date().getTime();
    // function update() {
    //   var now = window.performance.now();
    //   var p = new ConverterPixelProvider(provider, pal, (Math.sin(now/1000)+1)/2);
    //   console.log(now);
    //   IU.drawToCanvas(p, canvas);
    //   requestAnimationFrame(update);
    // }

    // update();

    provider = new ConverterPixelProvider(provider, pal, 1);
    IU.drawToCanvas(provider, canvas);
    
  });
}