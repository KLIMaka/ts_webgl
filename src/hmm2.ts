import AGG = require('./modules/engines/hmm2/agg');
import ICN = require('./modules/engines/hmm2/icn');
import getter = require('./libs/getter');
import pixel = require('./modules/pixelprovider');
import IU = require('./libs/imgutils');

var RES = 'resources/engines/h2/heroes2.agg';

getter.loader
.load(RES)
.finish(()=>{

var aggFile = AGG.create(getter.get(RES));
var pal = AGG.createPalette(aggFile.get('KB.PAL'));
var icnFile = ICN.create(aggFile.get('COBJ0000.ICN'));

for (var i = 0; i < icnFile.getCount(); i++) {
  var frame = icnFile.getFrame(i);
  var size = icnFile.getSize(i);
  var pp = new pixel.RGBPalPixelProvider(frame, pal, size.width, size.height, 255, 0);
  document.body.appendChild(IU.createCanvas(pp));
}


console.log(aggFile);
console.log(icnFile);

});