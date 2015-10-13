import MU = require('./libs/mathutils');
import P = require('modules/particles');
import GL = require('modules/gl');
import MB = require('modules/meshbuilder');
import C2D = require('./modules/controller2d');
import SHADERS = require('./modules/shaders');
import BATCHER = require('./modules/batcher');
import GLM = require('./libs_js/glmatrix');

var MAX_SIZE = 1000;

var gl = GL.createContext(600, 600, {alpha:false});
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
gl.enable(gl.BLEND);

var aPos = MB.createVertexBuffer(gl, gl.FLOAT, MAX_SIZE*4, 2, gl.DYNAMIC_DRAW);
var aColor = MB.createVertexBuffer(gl, gl.UNSIGNED_BYTE, MAX_SIZE*4, 4, gl.DYNAMIC_DRAW, true);

var vertexBufs = {
  'aPos': aPos,
  'aColor': aColor
}
var indexBuffer = MB.genIndexBuffer(gl, MAX_SIZE, [0, 1, 2, 0, 2, 3]);


function updateBuffers(ps:P.ParticleSystem):number {
  var plist = ps.getParticles();
  var term = plist.last().next;
  var idx = 0;
  for (var node = plist.first(); node != term; node = node.next) {
    var p = node.obj;
    var hs = p.attr.size/2;
    var id = p.id;
    var c = p.attr.color;
    var pos = aPos.getData();
    var color = aColor.getData();

    var off = idx*8;
    pos[off+0] = p.x-hs; pos[off+1] = p.y-hs; 
    pos[off+2] = p.x-hs; pos[off+3] = p.y+hs; 
    pos[off+4] = p.x+hs; pos[off+5] = p.y+hs; 
    pos[off+6] = p.x+hs; pos[off+7] = p.y-hs;

    var off = idx*16;
    color[off+0] = c[0]; color[off+1] = c[1]; color[off+2] = c[2]; color[off+3] = c[3];
    color[off+4] = c[0]; color[off+5] = c[1]; color[off+6] = c[2]; color[off+7] = c[3];
    color[off+8] = c[0]; color[off+9] = c[1]; color[off+10] = c[2]; color[off+11] = c[3];
    color[off+12] = c[0]; color[off+13] = c[1]; color[off+14] = c[2]; color[off+15] = c[3];

    idx++;
  }

  aPos.update(gl);
  aColor.update(gl);

  return idx*6;
}

var startColor = [127, 50, 50, 255];
var endColor = [50, 50, 50, 0];

function init(p:P.Particle) {
  p.x = x;
  p.y = y;
  p.ttl = Math.random() * 2;

  p.attr.size = 2 + 10 * Math.random();
  p.attr.color = [255, 1, 1, 255];

  p.vx = (Math.random() - 0.5) * 50;
  p.vy = -Math.random()*100;
}

function update(p:P.Particle, dt:number) {
  p.x += p.vx*dt;
  p.y += p.vy*dt;
  p.vx *= (1 - dt);
  p.vx += (Math.random()-0.5)*20;
  p.vy -= dt*200;

  GLM.vec4.lerp(p.attr.color, startColor, endColor, p.t);
  p.attr.size += dt*(10+Math.random()*10);
}

function die(p:P.Particle):boolean {
  return true;
}

var x = 0;
var y = 0;

gl.canvas.onmousemove = function(e) {
  var dx = e.x - x;
  var dy = e.y - y;
  var ox = x;
  var oy = y;
  for (var i = 0; i < 10; i++){
    x = ox + dx*(i/10);
    y = oy + dy*(i/10);
    particles.emit();
  }
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
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  particles.update(dt);
  var count = updateBuffers(particles);
  struct[1] = count;
  BATCHER.exec(cmds, gl);
});
