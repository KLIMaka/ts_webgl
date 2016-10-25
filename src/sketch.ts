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

// var pal = new Uint8Array(256*3);
// var hslPal = new Uint8Array(256*3);
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

class ConverterPixelProvider extends P.AbstractPixelProvider {
  private labPal:number[];

  constructor(private provider:P.PixelProvider, private pal:number[]) {
    super(provider.getWidth(), provider.getHeight());
    var xyzPal = COLOR.convertPal(pal, COLOR.rgb2xyz);
    this.labPal = COLOR.convertPal(xyzPal, COLOR.xyz2lab);
  }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    this.provider.putToDst(x, y, dst, dstoff);
    var xyz = COLOR.rgb2xyz(dst[dstoff+0],dst[dstoff+1],dst[dstoff+2]);
    var lab = COLOR.xyz2lab(xyz[0], xyz[1], xyz[2]);
    var [i, i1, t] = COLOR.findHsl(this.labPal, lab[0], lab[1], lab[2]);
    var idx = COLOR.dither(x, y, 0.5*t) ? i : i1;
    dst[dstoff+0] = this.pal[idx*3+0];
    dst[dstoff+1] = this.pal[idx*3+1];
    dst[dstoff+2] = this.pal[idx*3+2];
  }
}

getter.loader
.load('resources/engines/duke/duke3d.grp')
.finish(() => {

var file = getter.get('resources/engines/duke/duke3d.grp');
var grpFile = GRP.create(file);
var pal = GRP.createPalette(grpFile.get('PALETTE.DAT'));
var pal1 = new Array<number>(256*3);
for (var i = 0; i < 256*3; i++) pal1[i] = pal[i];

new FR.DropFileReader(
  document.getElementById('loader'),
  (f:File) => { return true },
  (buff:ArrayBuffer) => { processFile(buff, pal1) }
);

});

function processFile(buff:ArrayBuffer, pal:number[]) {
  IU.loadImageFromBuffer(buff, (provider:P.PixelProvider) => {
    provider = new ConverterPixelProvider(provider, pal);
    var canvas = IU.createCanvas(provider);
    document.body.appendChild(canvas);
  });
}