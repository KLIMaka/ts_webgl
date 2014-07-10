import data = require('./libs/dataviewstream');
import browser = require('./libs/browser');
import files = require('./modules/ui/filereader');
import Panel = require('./modules/ui/drawpanel');
import Raven = require('./modules/engines/raven');

var pal = null;
var res = null;

new files.DropFileReader(
  document.getElementById('palLoader'),
  (f:File) => { return f.name == 'COLORS' },
  (buff:ArrayBuffer) => {pal = buff; if(res != null) render(pal, res);}
);
new files.DropFileReader(
  document.getElementById('resLoader'),
  (f:File) => { return true },
  (buff:ArrayBuffer) => {res = buff; if(pal != null) render(pal, res);}
);

function render(palbuf:ArrayBuffer, resbuf:ArrayBuffer) {

  var res = new Raven.RavenRes(resbuf);
 
   var palres = new Raven.RavenPals(palbuf);
  var palnum = browser.getQueryVariable('pal');
  var pal = palres.get(palnum);

  var provider = new Panel.PixelDataProvider(res.size(), (i:number) => {
    return res.get(i, pal);
  });

  var p = new Panel.DrawPanel(<HTMLCanvasElement>document.getElementById('panel'), provider);
  p.setCellSize(100, 100);
  p.draw();

  document.getElementById('next').onclick = (e) => {p.nextPage(); p.draw();}
  document.getElementById('prev').onclick = (e) => {p.prevPage(); p.draw();}
}