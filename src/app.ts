/// <reference path="defs/webgl.d.ts"/>

import shaders = require('./modules/shader');
import mb = require('./modules/meshbuilder');
import getter = require('./libs/getter');
import build = require('./modules/buildloader');
import data = require('./libs/dataviewstream');
import controller = require('./modules/controller3d');
import buildutils = require('./modules/buildutils');
import buildstructs = require('./libs/buildstructs');

var w = 1000;
var h = 1000;

function setupGl():WebGLRenderingContext {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var gl = canvas.getContext('webgl', {antialias: true, alpha:false});

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
}

function load(file:string):string {
  return getter.getString(file);
}

function buildSprite(sprite:buildstructs.Sprite, gl:WebGLRenderingContext):mb.DrawData {
  var builder = new mb.MeshBuilder();
  var size = 1000;
  var halfSize = size / 2;
  var SCALE = -16;
  var x = sprite.x;
  var y = sprite.y;
  var z = sprite.z;

//  builder.addQuad([
//    [x - halfSize, z / SCALE, y + halfSize],
//    [x + halfSize, z / SCALE, y + halfSize],
//    [x + halfSize, z / SCALE, y - halfSize],
//    [x - halfSize, z / SCALE, y - halfSize],
//  ]);
  builder.addQuadWNormals([
    [x, z / SCALE, y],
    [x, z / SCALE, y],
    [x, z / SCALE, y],
    [x, z / SCALE, y]], [
    [-1, 1, 0],
    [1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0]
  ]);

  return builder.build(gl);
}

var gl = setupGl();
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get('resources/buildmaps/cube.map'), true));
var model = buildutils.buildBoard(board, gl);
var sprite = buildSprite(board.sprites[0], gl);
var baseShader = shaders.createShader(gl, load('resources/shaders/base.vsh'), load('resources/shaders/base.fsh'));
var spriteShader = shaders.createShader(gl, load('resources/shaders/sprite.vsh'), load('resources/shaders/sprite.fsh'));
var control = new controller.Controller3D(gl);

function draw(gl:WebGLRenderingContext, model:mb.DrawData, shader:shaders.Shader) {
  var attributes = model.getAttributes();
  for (var i in  attributes) {
    var attr = attributes[i];
    var buf = model.getVertexBuffer(attr);
    var location = shader.getAttributeLocation(attr, gl);
    if (location != -1) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.getBuffer());
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, buf.getSpacing(), buf.getType(), buf.getNormalized(), buf.getStride(), buf.getOffset());
    }
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

  control.move(time);
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(baseShader.getProgram());
  gl.uniformMatrix4fv(baseShader.getUniformLocation('MVP', gl), false, control.getMatrix());
  gl.uniform3fv(baseShader.getUniformLocation('eyepos', gl), control.getCamera().getPos());
  gl.uniform3fv(baseShader.getUniformLocation('eyedir', gl), control.getCamera().forward());
  draw(gl, model, baseShader);

  gl.useProgram(spriteShader.getProgram());
  gl.uniformMatrix4fv(spriteShader.getUniformLocation('MVP', gl), false, control.getMatrix());
  gl.uniformMatrix4fv(spriteShader.getUniformLocation('P', gl), false, control.getProjectionMatrix());
  gl.uniformMatrix4fv(spriteShader.getUniformLocation('MV', gl), false, control.getModelViewMatrix());
  gl.uniform1f(spriteShader.getUniformLocation('size', gl), 10);
  draw(gl, sprite, spriteShader);
});

gl.canvas.oncontextmenu = () => false;
