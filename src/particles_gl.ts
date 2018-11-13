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
  var idx = 0;
  var pos = new Float32Array(vertexBufs.aPos.getData().buffer);
  var color = new Uint8Array(vertexBufs.aColor.getData().buffer);
  
  for (var node = plist.first(); node != term; node = node.next) {
    if (idx >= MAX_SIZE)
        break;

    var p = node.obj.attr;
    var trace = p.trace;
    var prevx = node.obj.x;
    var prevy = node.obj.y;
    var maxtraces = 10;
    for (var i = trace.length - 1; i >= 0 && maxtraces >= 0; i--) {
      if (idx >= MAX_SIZE)
        break;

      var maxt = trace[trace.length-1][2];
      var t = trace[i];
      var off = idx*8;
      var rect = line(prevx, prevy, t[0], t[1], p.size);
      pos.set(rect, off);
      prevx = t[0];
      prevy = t[1];

      var off = idx*16;
      var c = color1.get(maxt-t[2]);
      color.set(c, off);
      color.set(c, off+4);
      color.set(c, off+8);
      color.set(c, off+12);

      idx++;
      maxtraces--;
    }
  }

  vertexBufs.aPos.update(gl);
  vertexBufs.aColor.update(gl);

  return idx*6;
}

function line(x1:number, y1:number, x2:number, y2:number, w:number) {
  var ortx = (y2-y1);
  var orty = (x2-x1);
  var ortl = Math.sqrt(ortx*ortx+orty*orty);
  ortx = (ortx/ortl)*(w/2);
  orty = (orty/ortl)*(w/2);
  return [
    x1+ortx, y1+orty,
    x2+ortx, y2+orty,
    x2-ortx, y2-orty,
    x1-ortx, y1-orty
  ];
}

var color1 = new INTER.Range([255, 255, 255, 255], [0,0,0,0], INTER.Vec4Interpolator);
color1.insert([255, 164, 89, 255*0.05], 0.05);
color1.insert([0, 0, 0, 255*0.1], 0.1);

function init(p:P.Particle, ctx:any) {
  p.ttl = RNG.rand0(1);
  p.x = 300;
  p.y = 600;
  p.vx = RNG.rand(-600, 600);
  p.vy = -RNG.rand(100,1200);

  p.attr.size = RNG.rand(1, 4);
  p.attr.color = color1.get(0);
  p.attr.trace = [];
}

function update(p:P.Particle, dt:number) {
  p.attr.trace.push([p.x, p.y, p.t]);
  p.x += p.vx*dt;
  p.y += p.vy*dt;
  p.vx += dt*RNG.rand(-10, 10)*60;
  p.vx *= Math.pow(0.985/60, dt);
  p.vy += dt*1400;

  p.attr.color = color1.get(p.t);
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

var particles = new P.ParticleSystem(MAX_SIZE/10, init, update, die);

var control = C2D.create(gl);
control.setUnitsPerPixel(1);
control.setPos(300, 300);
var shader = SHADERS.createShader(gl, 'resources/shaders/particle');
var MVP = ['MVP', BATCHER.setters.mat4, control.getMatrix()];
var struct = [gl.TRIANGLES, 0, 0];

var cmds = [
  BATCHER.clear, [0.3, 0.3, 0.3, 1.0],
  BATCHER.shader, shader,
  BATCHER.vertexBuffers, vertexBufs,
  BATCHER.indexBuffer, indexBuffer,
  BATCHER.uniforms, MVP,
  BATCHER.drawCall, struct
];

GL.animate(gl, function (gl:WebGLRenderingContext, dt:number) {

  particles.update(dt);
  struct[1] = updateBuffers(particles);
  BATCHER.exec(cmds, gl);

  for(var i = 0; i < 100; i++)
    particles.emit(null);
});
