import MU = require('./libs/mathutils');
import raster = require('modules/rasterizer');
import P = require('modules/particles');
import GL = require('modules/gl');
import MB = require('modules/meshbuilder');

var MAX_SIZE = 1000;

var gl = GL.createContext(400, 400);

var pos = new Float32Array(MAX_SIZE * 2);
var color = new Uint8Array(MAX_SIZE * 4);
var aPos = MB.genVertexBuffer(gl, gl.FLOAT, 2, false, pos);
var aColor = MB.genVertexBuffer(gl, gl.BYTE, 4, true, color);

var vertexBufs = {
  'aPos': aPos,
  'aColor': aColor
}
var indexBuffer = MB.genIndexBuffer(gl, MAX_SIZE, [0, 1, 2, 3]);


function updateBuffers(ps:P.ParticleSystem):number {
  var plist = ps.getParticles();
  var term = plist.last().next;
  var idx = 0;
  for (var node = plist.first(); node != term; node = node.next) {
    var p = node.obj;
    var hs = p.attr.size/2;
    var id = p.id;
    var color = p.attr.color;

    var off = idx*8;
    pos[off+0] = p.x-hs; pos[off+1] = p.y-hs; 
    pos[off+2] = p.x-hs; pos[off+3] = p.y+hs; 
    pos[off+4] = p.x+hs; pos[off+5] = p.y+hs; 
    pos[off+6] = p.x+hs; pos[off+7] = p.y-hs;

    var off = idx*16;
    color[off+0] = color[0]; color[off+1] = color[1]; color[off+2] = color[2]; color[off+3] = color[3];
    color[off+4] = color[0]; color[off+5] = color[1]; color[off+6] = color[2]; color[off+7] = color[3];
    color[off+8] = color[0]; color[off+9] = color[1]; color[off+10] = color[2]; color[off+11] = color[3];
    color[off+12] = color[0]; color[off+13] = color[1]; color[off+14] = color[2]; color[off+15] = color[3];

    idx++;
  }
  return idx*4;
}

function init(p:P.Particle) {
  p.x = x;
  p.y = y;
  p.ttl = Math.random() * 4;

  p.attr.size = 10 + 40 * Math.random();
  p.attr.color = [255, 255, 255, 255*Math.random()];

  p.vx = (Math.random() - 0.5) * 0.01;
  p.vy = -Math.random()*0.5;
}

function update(p:P.Particle, dt:number) {
  p.x += p.vx*dt;
  p.y += p.vy*dt;
  p.vx *= (1 - dt);
  p.vx += (Math.random()-0.5)*0.05;
  p.vy -= dt*0.5;
}

function die(p:P.Particle):boolean {
  return true;
}

var count = 1000;
var x = 0.5;
var y = 0.5;

var particles = new P.ParticleSystem(count, init, update, die);

gl.canvas.onmousemove = function(e) {
  x = e.x;
  y = e.y;
  for (var i = 0; i < 100; i++)
    particles.emit();
}

var bg = [128,128,128,255];
var pixel = [255,255,255,255];
var ctx = canvas.getContext('2d');
var img = ctx.getImageData(0, 0, w, h);
var rast = new raster.Rasterizer(img, (attrs:number[]) => {
  pixel[3] = (1-particles.getById(attrs[2]).t)*256;
  return pixel;
});
rast.bindAttributes(0, buffer, 3);

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
