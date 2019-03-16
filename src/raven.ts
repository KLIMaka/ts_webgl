import data = require('./libs/dataviewstream');
import browser = require('./libs/browser');
import files = require('./modules/ui/filereader');
import Panel = require('./modules/ui/drawpanel');
import Raven = require('./modules/engines/raven');
import PP = require('./modules/pixelprovider');
import IU = require('./libs/imgutils');
import MU = require('./libs/mathutils');

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

class AnimController {
  private x = 0;
  private y = 0;
  private ox = 0;
  private oy = 0;
  private destx = 0;
  private desty = 0;
  private curanim:PP.AnimatedPixelProvider;
  private curaminnum = 0;
  private ang = 3/4;

  constructor(private anims:PP.AnimatedPixelProvider[]) {
    this.ox = this.anims[0].getWidth() / 2;
    this.oy = this.anims[0].getHeight();
    this.x = 0;
    this.y = 0;
    this.destx = 0;
    this.desty = 0;
    this.curanim = this.anims[0];
    this.curaminnum = 0;
  }

  public getX(): number {
    return this.x;
  }

  public getY(): number {
    return this.y;
  }

  public goto(x:number, y:number): void {
    this.destx = x - this.ox;
    this.desty = y - this.oy;
  }

  public animate(dt:number): PP.PixelProvider {
    var time = Date.now() / 1000;
    if (this.destx == this.x && this.desty == this.y) {
      this.curanim.stop();
      return this.curanim.animate(time);
    }

    var rot = this.getRotation();
    if (this.angToIdx(this.ang) != this.angToIdx(rot)) {
      var sign = this.ang > rot 
        ? (this.ang - rot > 0.5 ? 1 : -1)
        : (rot - this.ang > 0.5 ? -1 : 1);
      var ang = this.ang;
      ang += sign * dt * 2;
      ang = ang > 1 ? ang - MU.int(ang) : (ang < 0 ? MU.int(-ang) + 1 + ang : ang);
      this.ang = ang;
      this.curanim = this.anims[this.angToIdx(this.ang)];
      this.curanim.stop();
      return this.curanim.animate(time);
    }
    this.curanim = this.anims[this.angToIdx(this.ang)];
    if (!this.curanim.isStarted())
      this.curanim.start(time);

    var d = this.getDNormalized();
    var s = dt * 150;
    if (Math.abs(this.destx - this.x) - s < 0)
      this.x = this.destx;
    else
      this.x += d[0] * s;
    if (Math.abs(this.desty - this.y) - s < 0)
      this.y = this.desty;
    else
      this.y += d[1] * s;
    return this.curanim.animate(time); 
  }

  private getRotation():number {
    var d = this.getDNormalized();
    var dx = d[0];
    var dy = d[1];
    var ang = Math.acos(dx);
    ang = dy > 0 ? 2*Math.PI - ang : ang;
    return ang / (Math.PI*2);
  }

  private getDNormalized() {
    var dx = this.destx - this.x;
    var dy = this.desty - this.y;
    var len = Math.sqrt(dx*dx + dy*dy);
    dx /= len;
    dy /= len;
    return [dx, dy];
  }

  private angToIdx(ang:number) {
    var hsect = 1 / 16;
    if (ang < hsect || ang > 15*hsect)
      return 6;
    if (ang > hsect && ang <= 3*hsect)
      return 5;
    if (ang > 3*hsect && ang <= 5*hsect)
      return 4;
    if (ang > 5*hsect && ang <= 7*hsect)
      return 3;
    if (ang > 7*hsect && ang <= 9*hsect)
      return 2;
    if (ang > 9*hsect && ang <= 11*hsect)
      return 1;
    if (ang > 11*hsect && ang <= 13*hsect)
      return 0;
    if (ang > 13*hsect && ang <= 15*hsect)
      return 7;
  }
}

function render(palbuf:ArrayBuffer, resbuf:ArrayBuffer) {

  var res = new Raven.RavenRes(resbuf);
 
  var palres = new Raven.RavenPals(palbuf);
  var palnum = browser.getQueryVariable('pal');
  var pal = palres.get(palnum);

  for (var i = 0; i < res.size(); i++) {
    var pp = res.get(i, pal);
    if (pp == null)
      continue;
    var c = IU.createCanvas(pp);
    document.body.appendChild(c);
  }


  // var provider = new Panel.PixelDataProvider(res.size(), (i:number) => {
  //   return res.get(i, pal);
  // });

  // var p = new Panel.DrawPanel(<HTMLCanvasElement>document.getElementById('panel'), provider);
  // p.setCellSize(200, 200);
  // p.draw();

  // document.getElementById('next').onclick = (e) => {p.nextPage(); p.draw();}
  // document.getElementById('prev').onclick = (e) => {p.prevPage(); p.draw();}
  // var canvas = <HTMLCanvasElement>document.getElementById('panel');
  // var off = browser.getQueryVariable('off') | 0;
  // var anims = [
  //   new PP.AnimatedPixelProvider([res.get(off+0, pal), res.get(off+8, pal), res.get(off+16, pal), res.get(off+24, pal)], 8),
  //   new PP.AnimatedPixelProvider([res.get(off+1, pal), res.get(off+9, pal), res.get(off+17, pal), res.get(off+25, pal)], 8),
  //   new PP.AnimatedPixelProvider([res.get(off+2, pal), res.get(off+10, pal), res.get(off+18, pal), res.get(off+26, pal)], 8),
  //   new PP.AnimatedPixelProvider([res.get(off+3, pal), res.get(off+11, pal), res.get(off+19, pal), res.get(off+27, pal)], 8),
  //   new PP.AnimatedPixelProvider([res.get(off+4, pal), res.get(off+12, pal), res.get(off+20, pal), res.get(off+28, pal)], 8),
  //   new PP.AnimatedPixelProvider([res.get(off+5, pal), res.get(off+13, pal), res.get(off+21, pal), res.get(off+29, pal)], 8),
  //   new PP.AnimatedPixelProvider([res.get(off+6, pal), res.get(off+14, pal), res.get(off+22, pal), res.get(off+30, pal)], 8),
  //   new PP.AnimatedPixelProvider([res.get(off+7, pal), res.get(off+15, pal), res.get(off+23, pal), res.get(off+31, pal)], 8),
  // ];
  // var c = new AnimController(anims);
  // canvas.onclick = e => c.goto(e.x - canvas.offsetLeft, e.y - canvas.offsetTop);

  // var callback = (dt:number) => {
  //   var pp = c.animate(dt);
  //   IU.clearCanvas(canvas, '#000');
  //   IU.drawToCanvas(pp, canvas, c.getX(), c.getY());
  // }

  // var time = Date.now();
  // function update() {
  //   var now = Date.now();
  //   callback((now - time) / 1000);
  //   requestAnimationFrame(update);
  //   time = now;
  // }

  // update();
}