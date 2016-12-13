import AGG = require('./modules/engines/hmm2/agg');
import ICN = require('./modules/engines/hmm2/icn');
import BIN = require('./modules/engines/hmm2/bin');
import getter = require('./libs/getter');
import pixel = require('./modules/pixelprovider');
import IU = require('./libs/imgutils');
import BROWSER = require('./libs/browser');

declare var config;

class IP implements BIN.IcnProvider {
  constructor(
    private aggFile:AGG.AggFile) 
  {}

  public get(name:string):ICN.IcnFile {
    name = name.toUpperCase();
    var file = this.aggFile.get(name);
    return  ICN.create(file);
  }
}

var RES = 'resources/engines/h2/heroes2.agg';

getter.loader
.load(RES)
.finish(()=>{

var aggFile = AGG.create(getter.get(RES));
var pal = AGG.createPalette(aggFile.get('KB.PAL'));
var name = BROWSER.getQueryVariable('name');
var file = aggFile.get(name.toUpperCase());
var bin = BIN.create(file, pal);
var ip = new IP(aggFile);
var canvas = bin.render(ip);
document.body.appendChild(canvas);

});