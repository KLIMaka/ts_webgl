import MU = require('./libs/mathutils');
import P = require('./modules/particles');
import GL = require('./modules/gl');
import MB = require('./modules/meshbuilder');
import C2D = require('./modules/controller2d');
import SHADERS = require('./modules/shaders');
import BATCHER = require('./modules/batcher');
import GLM = require('./libs_js/glmatrix');
import INTER = require('./modules/interpolator');
import RNG = require('./modules/random');

var MAX_SIZE = 10000;

var gl = GL.createContext(600, 600, {alpha:false});
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);

var vertexBufs = {
  'aPos': MB.createVertexBuffer(gl, gl.FLOAT, MAX_SIZE*4, 2, gl.DYNAMIC_DRAW),
  'aColor': MB.createVertexBuffer(gl, gl.UNSIGNED_BYTE, MAX_SIZE*4, 4, gl.DYNAMIC_DRAW, true)
}
var indexBuffer = MB.genIndexBuffer(gl, MAX_SIZE, [0, 1, 2, 0, 2, 3]);
var p4 = Math.PI/4;

function updateBuffers(ps:P.ParticleSystem):number {
  var plist = ps.getParticles();
  var term = plist.last().next;
  var idx = 8;
  var pos = vertexBufs.aPos.getData();
  var color = vertexBufs.aColor.getData();

  // line(pos, 0, 100, 100, 500, 200, 1);

  rope(pos, 0, [100, 200, 200, 100, 100], [300, 300, 200, 200, 300], 1);
  fillQuad(color, 0, 255, 255, 255, 255);
  fillQuad(color, 16, 255, 255, 255, 255);
  fillQuad(color, 32, 255, 255, 255, 255);
  fillQuad(color, 48, 255, 255, 255, 255);
  fillQuad(color, 64, 255, 255, 255, 255);
  fillQuad(color, 80, 255, 255, 255, 255);
  fillQuad(color, 96, 255, 255, 255, 255);
  fillQuad(color, 112, 255, 255, 255, 255);
  fillQuad(color, 128, 255, 255, 255, 255);

  // for (var node = plist.first(); node != term; node = node.next) {
  //   var p = node.obj;
  //   var c = p.attr.color;

  //   centredQuad(pos, idx*8, p.x, p.y, p.attr.size, p.attr.ang);
  //   fillQuad(color, idx*16, c[0], c[1], c[2], c[3]);

  //   idx++;
  // }

  vertexBufs.aPos.update(gl);
  vertexBufs.aColor.update(gl);

  return 50*6;
}

function quad(pos:ArrayBufferView, off:number, x1, y1, x2, y2, x3, y3, x4, y4) {
  pos[off+0] = x1; pos[off+1] = y1;
  pos[off+2] = x2; pos[off+3] = y2;
  pos[off+4] = x3; pos[off+5] = y3;
  pos[off+6] = x4; pos[off+7] = y4;
}

function line(pos:ArrayBufferView, posoff:number, x1:number, y1:number, x2:number, y2:number, w:number) {
  var dx = x2 - x1;
  var dy = y2 - y1;
  var l = Math.sqrt(dx*dx + dy*dy);
  dx /= l; dy /= l;
  w /= 2;

  quad(pos, posoff,
    x1 - dy*w, y1 + dx*w,
    x2 - dy*w, y2 + dx*w,
    x2 + dy*w, y2 - dx*w,
    x1 + dy*w, y1 - dx*w,
  );
}

function fillQuad(color:ArrayBufferView, off:number, r:number, g:number, b:number, a:number) {
  color[off+0] = r; color[off+1] = g; color[off+2] = b; color[off+3] = a;
  color[off+4] = r; color[off+5] = g; color[off+6] = b; color[off+7] = a;
  color[off+8] = r; color[off+9] = g; color[off+10] = b; color[off+11] = a;
  color[off+12] = r; color[off+13] = g; color[off+14] = b; color[off+15] = a;
}

function centredQuad(pos:ArrayBufferView, off:number, x:number, y:number, size:number, ang:number) {
  var hs = size/2;
  quad(pos, off,
    x+Math.sin(ang+p4)*hs, y+Math.cos(ang+p4)*hs,
    x+Math.sin(ang+3*p4)*hs, y+Math.cos(ang+3*p4)*hs,
    x+Math.sin(ang+5*p4)*hs, y+Math.cos(ang+5*p4)*hs,
    x+Math.sin(ang+7*p4)*hs, y+Math.cos(ang+7*p4)*hs
  );
}

function rope(pos:ArrayBufferView, off:number, xs:number[], ys:number[], w:number) {
  var hw = w / 2;
  var pdx = xs[1] - xs[0];
  var pdy = ys[1] - ys[0];
  var pl = Math.sqrt(pdx*pdx + pdy*pdy);
  var npdx = pdx / pl;
  var npdy = pdy / pl;

  for (var i = 0; i < xs.length-1; i++) {
    line(pos, off += 8, xs[i], ys[i], xs[i+1], ys[i+1], w);
    if (i == xs.length-2)
      break;

    var dx = xs[i+2] - xs[i+1];
    var dy = ys[i+2] - ys[i+1];
    var l = Math.sqrt(dx*dx + dy*dy);
    var ndx = dx / l;
    var ndy = dy / l;

    quad(pos, off += 8,
      xs[i+1] - npdy*hw, ys[i+1] + npdx*hw,
      xs[i+1] - ndy*hw, ys[i+1] + ndx*hw,
      xs[i+1] + ndy*hw, ys[i+1] - ndx*hw,
      xs[i+1] + npdy*hw, ys[i+1] - npdx*hw
    );

    npdx = ndx;
    npdy = ndy;
  }
}

var color = new INTER.Range([255, 255, 255, 255], [0,0,0,0], INTER.Vec4Interpolator);
color.insert([255, 164, 89, 255*0.8], 0.2, INTER.Vec4Interpolator);
color.insert([0, 0, 0, 255*0.2], 0.8, INTER.Vec4Interpolator);
var ang = 0;

function init(p:P.Particle) {
  var dx = Math.sin(ang);
  var dy = Math.cos(ang);
  var w = RNG.rand(-100, 100);
  if (RNG.coin()) {
    p.x = x + dx * w;
    p.y = y + dy * w;
  } else {
    p.x = x - dy * w;
    p.y = y + dx * w;
  }
  p.ttl = RNG.rand0(2);

  p.attr.size = RNG.rand(2, 10);
  p.attr.color = color.get(0);
  p.attr.ang = RNG.rand0(3.14);
  p.attr.vang = RNG.rand(-10, 10);

  p.vx = RNG.rand(-25, 25);
  p.vy = -RNG.rand0(100);
}

function update(p:P.Particle, dt:number) {
  p.x += p.vx*dt;
  p.y += p.vy*dt;
  p.vx *= (1 - dt);
  p.vx += RNG.rand(-10, 10);;
  p.vy -= dt*200;

  p.attr.color = color.get(p.t);
  p.attr.size += dt*RNG.rand(-10, 30);
  p.attr.ang += dt*p.attr.vang;
}

function die(p:P.Particle):boolean {
  return true;
}

var x = 300;
var y = 300;

gl.canvas.onmousemove = function(e) {
  // var dx = e.clientX - x;
  // var dy = e.clientY - y;
  // var ox = x;
  // var oy = y;
  // for (var i = 0; i < 10; i++){
  //   x = ox + dx*(i/10);
  //   y = oy + dy*(i/10);
  //   particles.emit();
  // }
  // x = e.clientX;
  // y = e.clientY;
}

var particles = new P.ParticleSystem(MAX_SIZE, init, update, die);

var control = C2D.create(gl);
control.setUnitsPerPixel(1);
control.setPos(300, 300);
var shader = SHADERS.createShader(gl, 'resources/shaders/particle');
var MVP = control.getMatrix();
var struct = [gl.TRIANGLES, 0, 0];

var cmds = [
  BATCHER.shader, shader,
  BATCHER.vertexBuffers, vertexBufs,
  BATCHER.indexBuffer, indexBuffer,
  BATCHER.uniforms, ['MVP', BATCHER.setters.mat4, MVP],
  BATCHER.drawCall, struct
];

GL.animate(gl, function (gl:WebGLRenderingContext, dt:number) {
  gl.clearColor(0.3, 0.3, 0.3, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  particles.update(dt);
  struct[1] = updateBuffers(particles);
  BATCHER.exec(cmds, gl);

  ang += dt;
  for(var i = 0; i < 40; i++)
    particles.emit();
});
