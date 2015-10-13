import AGG = require('./modules/engines/hmm2/agg');
import ICN = require('./modules/engines/hmm2/icn');
import BIN = require('./modules/engines/hmm2/bin');
import getter = require('./libs/getter');
import pixel = require('./modules/pixelprovider');
import IU = require('./libs/imgutils');
import BROWSER = require('./libs/browser');

declare var config;

class IP implements BIN.IcnProvider {
  constructor(private aggFile:AGG.AggFile) {}

  public get(name:string):ICN.IcnFile {
    return  ICN.create(this.aggFile.get(name.toUpperCase()));
  }
}

var RES = 'resources/engines/h2/heroes2.agg';

getter.loader
.load(RES)
.finish(()=>{

var aggFile = AGG.create(getter.get(RES));
var pal = AGG.createPalette(aggFile.get('KB.PAL'));
var ip = new IP(aggFile);
var bin = BIN.create(aggFile.get(BROWSER.getQueryVariable('name')), pal);
var canvas = bin.render(ip);
document.body.appendChild(canvas);

});