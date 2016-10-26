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

var pal = new Uint8Array(16*3);
pal[0] = 0;   pal[1] =   0; pal[2] =   0;
pal[3] = 62;  pal[4] =  49; pal[5] = 162;
pal[6] = 87;  pal[7] =  66; pal[8] =   0;
pal[9] = 140; pal[10] =  62; pal[11] =  52;
pal[12] = 84;  pal[13] =  84; pal[14] =  84;
pal[15] = 141; pal[16] =  72; pal[17] = 179;
pal[18] = 144; pal[19] =  95; pal[20] =  37;
pal[21] = 124; pal[22] = 112; pal[23] = 218;
pal[24] = 128; pal[25] = 128; pal[26] = 128;
pal[27] = 104; pal[28] = 169; pal[29] =  65;
pal[30] = 187; pal[31] = 119; pal[32] = 109;
pal[33] = 122; pal[34] = 191; pal[35] = 199;
pal[36] = 171; pal[37] = 171; pal[38] = 171;
pal[39] = 208; pal[40] = 220; pal[41] = 113;
pal[42] = 172; pal[43] = 234; pal[44] = 136;
pal[45] = 255; pal[46] = 255; pal[47] = 255;

class ColorReducer extends P.AbstractPixelProvider {
   constructor(private provider:P.PixelProvider, private k:number) {
     super(provider.getWidth(), provider.getHeight());
   }

  public putToDst(x:number, y:number, dst:Uint8Array, dstoff:number):void {
    var pixel = this.provider.putToDst(x, y, dst, dstoff);
    dst[dstoff+0] = MU.int(dst[dstoff+0] / this.k) * this.k;
    dst[dstoff+1] = MU.int(dst[dstoff+1] / this.k) * this.k;
    dst[dstoff+2] = MU.int(dst[dstoff+2] / this.k) * this.k;
    dst[dstoff+3] = MU.int(dst[dstoff+3] / this.k) * this.k;
  }
}


new FR.DropFileReader(
  document.getElementById('loader'),
  (f:File) => { return true },
  (buff:ArrayBuffer) => { processFile(buff) }
);

function processFile(buff:ArrayBuffer) {
  IU.loadImageFromBuffer(buff, (provider:P.PixelProvider) =>{
    provider = new ColorReducer(provider, 50);
    var canvas = IU.createCanvas(provider);
    document.body.appendChild(canvas);
  });
}