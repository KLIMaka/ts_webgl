/// <reference path="defs/webgl.d.ts"/>

import shaders = require('./modules/shader');
import mb = require('./modules/meshbuilder');
import GLM = require('./libs/glmatrix');
import build = require('./modules/buildloader');
import data = require('./libs/dataviewstream');
import getter = require('./libs/getter');
import controller = require('./modules/controller2d');

var w = 800;
var h = 600;

function setupGl():WebGLRenderingContext {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var gl = canvas.getContext('webgl', {antialias:true});

  document.body.appendChild(gl.canvas);
  document.body.style.overflow = 'hidden';
  gl.canvas.style.position = 'absolute';
  return gl;
}

function animate(gl:WebGLRenderingContext, callback) {
  var time = new Date().getTime();

  function update() {
    var now = new Date().getTime();
    callback(gl, (now - time) / 1000);
    requestAnimationFrame(update);
    time = now;
  }

  update();
};

function load(file:string):string {
  return getter.getString(file);
}

var gl = setupGl();

var board = build.loadBuildMap(new data.DataViewStream(getter.get('./tests/RCPD.map'), true));

var builder = new mb.WireBuilder();
var minx = 0xFFFF;
var maxx = 0;
var miny = 0xFFFF;
var maxy = 0;
var walls = board.walls;
for (var i = 0; i < walls.length; i++) {
  var wall = walls[i];
  if (wall.x > maxx) maxx = wall.x;
  if (wall.x < minx) minx = wall.x;
  if (wall.y > maxy) maxy = wall.y;
  if (wall.y < miny) miny = wall.y;
  var nwall = walls[wall.point2];
  builder.addLine([wall.x, wall.y], [nwall.x, nwall.y]);
}
console.log('parsed ' + walls.length + ' walls');

var model = builder.build(gl);
var shader = shaders.createShader(gl, load('shaders/s.vsh'), load('shaders/s.fsh'));
var control = new controller.Controller2D(gl);
control.setScale(100);

function draw(gl:WebGLRenderingContext, model:mb.DrawData, shader:shaders.Shader) {
  var attributes = model.getAttributes();
  for (var i in  attributes) {
    var attr = attributes[i];
    var buf = model.getVertexBuffer(attr);
    var location = shader.getAttributeLocation(attr, gl);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
  }

  if (model.getIndexBuffer() == null) {
    gl.drawArrays(model.getMode(), model.getOffset(), model.getLength());
  } else {
    var idxBuf = model.getIndexBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf.getBuffer());
    gl.drawElements(model.getMode(), model.getLength(), idxBuf.getType(), model.getOffset());
  }
}

animate(gl, function (gl:WebGLRenderingContext, time:number) {

  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(shader.getProgram());
  gl.uniformMatrix4fv(shader.getUniformLocation('MVP', gl), false, control.getMatrix());

  draw(gl, model, shader);
});

gl.canvas.oncontextmenu = () => false;
