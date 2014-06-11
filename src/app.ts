import MU = require('./libs/mathutils');
import raster = require('./modules/rasterizer');

class Particle {
  public x:number;
  public y:number;
  public vx:number;
  public vy:number;
  public size:number;
  public visible:boolean;
  public ttl:number;
}

function createParticles(n:number):Particle[] {
  var particles = new Array<Particle>(n);
  for (var i = 0; i < n; i++)
    particles[i] = new Particle();
  return particles;
}

function updateBuffers(particles:Particle[], buffer:number[]):void {
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    var idx = i * 8;
    if (!p.visible) {
      buffer[idx+0] = 0; buffer[idx+1] = 0;
      buffer[idx+2] = 0; buffer[idx+3] = 0;
      buffer[idx+4] = 0; buffer[idx+5] = 0;
      buffer[idx+6] = 0; buffer[idx+7] = 0;
      continue;
    }
    var hs = p.size/2;
    buffer[idx+0] = p.x-hs; buffer[idx+1] = p.y-hs;
    buffer[idx+2] = p.x-hs; buffer[idx+3] = p.y+hs;
    buffer[idx+4] = p.x+hs; buffer[idx+5] = p.y+hs;
    buffer[idx+6] = p.x+hs; buffer[idx+7] = p.y-hs;
  }
}

function createIdxs(n:number):number[] {
  var idxs = [];
  for (var i = 0; i < n; i++) {
    var idx = i * 4;
    idxs.push(idx, idx+1, idx+2, idx, idx+2, idx+3);
  }
  return idxs;
}

function initParticle(p:Particle) {
  var scale = Math.random();
  p.size = 2/h + (3/h) * scale;
  p.x = 0.5;
  p.y = 0.5;
  p.visible = true;
  p.ttl = Math.random() * 2;

  var ang = Math.random() * Math.PI * 2;
  var acc = Math.random();
  p.vx = Math.sin(ang) * acc * 2;
  p.vy = Math.cos(ang) * acc * 2;
}

function initParticles(particles:Particle[]) {
  for (var i = 0; i < particles.length; i++) {
    initParticle(particles[i]);
  }
}

function updateParticles(particles:Particle[], dt:number) {
  if (dt <= 0)
    return;
  for (var i = 0; i < particles.length; i++) {
    var p = particles[i];
    p.ttl -= dt;
    if (p.ttl <= 0) {
      initParticle(p);
      continue;
    }

    p.x += p.vx*dt; 
    p.y += p.vy*dt;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.vy += dt;
  }
}

var count = 1000;
var w = 300;
var h = 300;
var particles = createParticles(count);
initParticles(particles);
var buffer = new Array<number>(count*8);
updateBuffers(particles, buffer);
var idxs = createIdxs(count);

var canvas:HTMLCanvasElement = document.createElement('canvas');
canvas.width = w;
canvas.height = h;
document.body.appendChild(canvas);

var bg = [128,128,128,255];
var pixel = [255,255,255,255];
var ctx = canvas.getContext('2d');
var img = ctx.getImageData(0, 0, w, h);
var rast = new raster.Rasterizer(img, (attrs:number[]) => {
  return pixel;
});
rast.bindAttributes(0, buffer, 2);
var time = new Date().getTime();

function update() {
  var now = new Date().getTime();
  rast.clear(bg);
  rast.drawTriangles(idxs);
  ctx.putImageData(img, 0, 0);
  updateParticles(particles, (now - time) / 1000);
  updateBuffers(particles, buffer);
  requestAnimationFrame(update);
  time = now;
}

update();
