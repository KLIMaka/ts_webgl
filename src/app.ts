import MU = require('./libs/mathutils');
import raster = require('./modules/rasterizer');
import P = require('modules/particles');

function updateBuffers(ps:P.ParticleSystem, buffer:number[]):number {
  var plist = ps.getParticles();
  var term = plist.last().next;
  var idx = 0;
  for (var node = plist.first(); node != term; node = node.next) {
    var p = node.obj;
    var hs = p.size/2;
    buffer[idx+0] = p.x-hs; buffer[idx+1] = p.y-hs;
    buffer[idx+2] = p.x-hs; buffer[idx+3] = p.y+hs;
    buffer[idx+4] = p.x+hs; buffer[idx+5] = p.y+hs;
    buffer[idx+6] = p.x+hs; buffer[idx+7] = p.y-hs;
    idx+=8;
  }
  return 6 * idx/8;
}

function createIdxs(n:number):number[] {
  var idxs = [];
  for (var i = 0; i < n; i++) {
    var idx = i * 4;
    idxs.push(idx, idx+1, idx+2, idx, idx+2, idx+3);
  }
  return idxs;
}

function init(p:P.Particle) {
  p.size = (1/h) + (8/h) * Math.random();
  p.x = x;
  p.y = y;
  p.ttl = Math.random() * 4;

  var ang = Math.random() * Math.PI * 2;
  var acc = Math.random();
  p.vx = (Math.random() - 0.5) * 0.01;
  p.vy = -Math.random()*0.5;
}

function update(p:P.Particle, dt:number) {
  p.x += p.vx*dt; 
  p.y += p.vy*dt;
  // if (p.y > 1)
  //   p.vy = -p.vy;
  // if (p.x > 1 || p.x < 0)
  //   p.vx = -p.vx;
  p.vx *= (1 - dt);
  // p.vy *= (1 - dt);
  p.vx += (Math.random()-0.5)*0.05;
  p.vy -= dt*0.5;
}

function die(p:P.Particle):boolean {
  return true;
}

var count = 1000;
var w = 300;
var h = 300;
var x = 0.5;
var y = 0.5;

var particles = new P.ParticleSystem(count, init, update, die);
var buffer = new Array<number>(count*8);
var idxs = createIdxs(count);

var canvas:HTMLCanvasElement = document.createElement('canvas');
canvas.width = w;
canvas.height = h;
document.body.appendChild(canvas);

canvas.onmousemove = function(e) {
  x = e.x / w;
  y = e.y / h;
  for (var i = 0; i < 100; i++)
    particles.emit();
}

var bg = [128,128,128,255];
var pixel = [255,255,255,255];
var ctx = canvas.getContext('2d');
var img = ctx.getImageData(0, 0, w, h);
var rast = new raster.Rasterizer(img, (attrs:number[]) => {
  return pixel;
});
rast.bindAttributes(0, buffer, 2);

var time = new Date().getTime();

function update_frame() {
  var now = new Date().getTime();
  var dt = (now - time) / 1000;

  particles.update(dt);
  var size = updateBuffers(particles, buffer);
  
  rast.clear(bg, 0);
  rast.drawTriangles(idxs, 0, size);
  ctx.putImageData(img, 0, 0);
  requestAnimationFrame(update_frame);
  time = now;
}

update_frame();
