import GRP = require('./modules/engines/build/grp');
import ART = require('./modules/engines/build/art');
import RFF = require('./modules/engines/build/rff');

import IU = require('./libs/imgutils');
import pixel = require('./modules/pixelprovider');
import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');


// getter.loader
// .load('resources/engines/duke/duke3d.grp')
// .finish(() => {

// var file = getter.get('resources/engines/duke/duke3d.grp');
// var grpFile = GRP.create(file);
// var pal = GRP.createPalette(grpFile.get('PALETTE.DAT'));

// for (var a = 0; a < 20; a++) {
//   var art = ART.create(grpFile.get('TILES0'+("00" + a).slice(-2)+'.ART'));
//   for (var i = 0; i < art.size; i++) {
//     var w = art.getWidth(i);
//     var h = art.getHeight(i);
//     if (w == 0 || h == 0)
//       continue;
//     var pp = pixel.axisSwap(new pixel.RGBPalPixelProvider(art.getImage(i), pal, w, h));
//     document.body.appendChild(IU.createCanvas(pp));
//   }
// }

// });

var path = 'resources/engines/blood/';
var arts = [];
for (var a = 0; a < 18; a++) {
  arts[a] = path + 'TILES0'+("00" + a).slice(-2)+'.ART';
  getter.loader.load(arts[a]);
}

getter.loader
.load('resources/engines/blood/palette.dat')
.load('resources/engines/blood/sounds.rff')
.finish(() => {

var rff = RFF.create(getter.get('resources/engines/blood/sounds.rff'));
console.log(rff);
var pal = GRP.createPalette(new data.DataViewStream(getter.get('resources/engines/blood/palette.dat'), true));

for (var a = 0; a < 18; a++) {
  var art = ART.create(new data.DataViewStream(getter.get(arts[a]), true));
  for (var i = 0; i < art.size; i++) {
    var w = art.getWidth(i);
    var h = art.getHeight(i);
    if (w == 0 || h == 0)
      continue;
    var pp = pixel.axisSwap(new pixel.RGBPalPixelProvider(art.getImage(i), pal, w, h, 255, 255));
    document.body.appendChild(IU.createCanvas(pp));
  }
}

});