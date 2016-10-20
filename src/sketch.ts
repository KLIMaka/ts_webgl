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


new FR.DropFileReader(
  document.getElementById('loader'),
  (f:File) => { return true },
  (buff:ArrayBuffer) => { processFile(buff) }
);

function processFile(buff:ArrayBuffer) {
  IU.loadImageFromBuffer(buff, (provider:P.PixelProvider) =>{
    provider = P.fit(200, 200, provider);
    var canvas = IU.createCanvas(provider);
    document.body.appendChild(canvas);
  });
}