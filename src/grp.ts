import GRP = require('./modules/engines/build/grp');
import ART = require('./modules/engines/build/art');
import RFF = require('./modules/engines/build/rff');

import IU = require('./libs/imgutils');
import pixel = require('./modules/pixelprovider');
import getter = require('./libs/getter');
import data = require('./libs/stream');
import browser = require('./libs/browser');
import MU = require('./libs/mathutils');


// getter.loader
// .load('resources/engines/duke/duke3d.grp')
// .finish(() => {

// var file = getter.get('resources/engines/duke/duke3d.grp');
// var grpFile = GRP.create(file);
// var pal = GRP.createPalette(grpFile.get('PALETTE.DAT'));

// for (var a = 0; a < 20; a++) {
//   var art = ART.create(grpFile.get('TILES0'+("00" + a).slice(-2)+'.ART'));
//   for (var i = 0; i < art.size; i++) {
//     var info = art.getInfo(i);
//     var w = info.w;
//     var h = info.h;
//     if (w == 0 || h == 0)
//       continue;
//     var pp = pixel.axisSwap(new pixel.RGBPalPixelProvider(info.img, pal, w, h));
//     document.body.appendChild(IU.createCanvas(pp));
//   }
// }

// });

var from = browser.getQueryVariable('from');
var to = browser.getQueryVariable('to');

var path = 'resources/engines/blood/';
var artNames = [];
for (var a = 0; a < 18; a++) {
  artNames[a] = path + 'TILES0' + ("00" + a).slice(-2) + '.ART';
  getter.loader.load(artNames[a]);
}

getter.loader
  .load('resources/engines/blood/palette.dat')
  .finish(() => {

    var pal = GRP.createPalette(new data.Stream(getter.get('resources/engines/blood/palette.dat'), true));
    var arts = [];
    for (var a = 0; a < 18; a++)
      arts.push(ART.create(new data.Stream(getter.get(artNames[a]), true)));
    var artFiles = ART.createArts(arts);

    var maxw = 0;
    var maxh = 0;
    for (var i = from; i <= to; i++) {
      var info = artFiles.getInfo(i);
      var xo = MU.ubyte2byte((info.anum >> 8) & 0xFF);
      var yo = MU.ubyte2byte((info.anum >> 16) & 0xFF);
      maxw = Math.max(maxw, info.w + Math.abs(xo));
      maxh = Math.max(maxw, info.h + Math.abs(yo));
    }

    console.log(maxw + ' ' + maxh);


    for (var i = from; i <= to; i++) {
      var info = artFiles.getInfo(i);
      if (info == null || info.w == 0 || info.h == 0)
        continue;
      var xo = MU.ubyte2byte((info.anum >> 8) & 0xFF);
      var yo = MU.ubyte2byte((info.anum >> 16) & 0xFF);
      var img = pixel.axisSwap(pixel.fromPal(info.img, pal, info.w, info.h, 255, 255));
      var op = pixel.offset(img, 128, 128, xo, yo);
      // var pp = pixel.fit(maxh, maxw, op);
      document.body.appendChild(IU.createCanvas(op));
    }

    // for (var i = 0; i < 18*256; i++) {
    //   var info = artFiles.getInfo(i);
    //   if (info == null || info.w == 0 || info.h == 0)
    //     continue;
    //   var pp = pixel.axisSwap(pixel.fromPal(info.img, pal, info.w, info.h, 255, 255));
    //   document.body.appendChild(IU.createCanvas(pp));
    // }
  });