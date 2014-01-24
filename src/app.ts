/// <reference path="defs/webgl.d.ts"/>

import shaders = require('./modules/shader');
import mb = require('./modules/meshbuilder');
import getter = require('./libs/getter');
import build = require('./modules/buildloader');
import data = require('./libs/dataviewstream');
import controller = require('./modules/controller3d');
import buildutils = require('./modules/buildutils');
import buildstructs = require('./libs/buildstructs');
import GLM = require('libs_js/glmatrix');
import tex = require('./modules/textures');
import camera = require('./modules/camera');
import MU = require('./libs/mathutils');
import raster = require('./modules/rasterizer');
import tcpack = require('./modules/texcoordpacker');

function createCanvas(w:number, h:number) {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  document.body.appendChild(canvas);

  var buffer = [
    0, 0.5, 0, 0, 255, 255,
    0.5, 1, 255, 0, 0, 255,
    1, 0.5, 0, 255, 0, 255,

    0.5, 0, 255, 0, 255, 255,
    0.25, 0.5, 0, 255, 255, 255,
    0.75, 0.5, 255, 255, 0, 255
  ];

  var ctx = canvas.getContext('2d');
  var img = ctx.createImageData(w, h);
  var px = [0,0,0,0];
  var rast = new raster.Rasterizer(img, (p:raster.Pixel) => {
    px[0] = p.attrs[2];
    px[1] = p.attrs[3];
    px[2] = p.attrs[4];
    px[3] = 255;
    return px;
  });
  rast.bindAttribute(0, buffer, 0, 6);
  rast.bindAttribute(1, buffer, 1, 6);
  rast.bindAttribute(2, buffer, 2, 6);
  rast.bindAttribute(3, buffer, 3, 6);
  rast.bindAttribute(4, buffer, 4, 6);
  rast.bindAttribute(5, buffer, 5, 6);
  rast.drawTriangles([0, 1, 2, 5, 4, 3]);
  ctx.putImageData(img, 0, 0);
}

createCanvas(300, 300);

var w = 600;
var h = 400;

function setupGl():WebGLRenderingContext {
  var canvas:HTMLCanvasElement = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  var gl = canvas.getContext('webgl', {antialias: false, alpha: true});

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

var SCALE = -16;
function buildSprite(sprite:buildstructs.Sprite, gl:WebGLRenderingContext):mb.DrawData {
  var builder = new mb.MeshBuilder();
  var x = sprite.x;
  var y = sprite.y;
  var z = sprite.z;

  builder.addQuadWNormals([
    [x, z / SCALE, y],
    [x, z / SCALE, y],
    [x, z / SCALE, y],
    [x, z / SCALE, y]
  ], [
    [-1, 1, 0],
    [1, 1, 0],
    [1, -1, 0],
    [-1, -1, 0]
  ]);

  return builder.build(gl);
}

function buildScreen(gl:WebGLRenderingContext) {
  var builder = new mb.MeshBuilder();
  builder.addQuadWNormals([
    [0, 0, 0],
    [100, 0, 0],
    [100, 100, 0],
    [0, 100, 0]
  ], [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0]
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

var sect = board.sectors[0];
var wall1 = board.walls[sect.wallptr];
var wall2 = board.walls[wall1.point2];
var size = 32;
var x = 0;
var y = 0;
var step = 4096 / size;
var start = GLM.vec3.fromValues(wall1.x, sect.ceilingz / SCALE, wall1.y);
var planeVec = GLM.vec3.normalize(GLM.vec3.create(), GLM.vec3.fromValues(wall2.x - wall1.x, 0, wall2.y - wall2.y));
var dVec = GLM.vec3.fromValues(0, -1, 0);
var dx = GLM.vec3.create();
var dy = GLM.vec3.create();
var npos = GLM.vec3.create();
var RTSize = 128;
var RT = new tex.RenderTexture(RTSize, RTSize, new Uint8Array(4 * RTSize * RTSize), gl);
var tex1 = new tex.DrawTexture(size, size, new Uint8Array(4 * size * size), gl);
var pixel = new Uint8Array(4);
var cam = new camera.Camera(0, 0, 0, 0, 180);
var trace_baseShader = shaders.createShader(gl, load('resources/shaders/trace_base.vsh'), load('resources/shaders/trace_base.fsh'));
var trace_spriteShader = shaders.createShader(gl, load('resources/shaders/trace_sprite.vsh'), load('resources/shaders/trace_sprite.fsh'));
var tmpMat = GLM.mat4.create();
var fov = 100;

var texShader = shaders.createShader(gl, load('resources/shaders/base1.vsh'), load('resources/shaders/base1.fsh'));
var screen = buildScreen(gl);

function trace(gl:WebGLRenderingContext) {
  GLM.vec3.scale(dx, planeVec, x * step);
  GLM.vec3.scale(dy, dVec, y * step);
  GLM.vec3.add(npos, start, dx);
  GLM.vec3.add(npos, npos, dy);
  cam.setPos(npos);

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  GLM.mat4.perspective(tmpMat, MU.deg2rad(fov), 1, 1, 0xFFFF);
  GLM.mat4.mul(tmpMat, tmpMat, cam.getTransformMatrix());

  gl.useProgram(trace_baseShader.getProgram());
  gl.uniformMatrix4fv(trace_baseShader.getUniformLocation('MVP', gl), false, tmpMat);
  gl.uniform3fv(trace_baseShader.getUniformLocation('eyepos', gl), cam.getPos());
  gl.uniform3fv(trace_baseShader.getUniformLocation('eyedir', gl), cam.forward());
  draw(gl, model, trace_baseShader);

  gl.useProgram(trace_spriteShader.getProgram());
  gl.uniformMatrix4fv(trace_spriteShader.getUniformLocation('MVP', gl), false, tmpMat);
  GLM.mat4.perspective(tmpMat, MU.deg2rad(fov), 1, 1, 0xFFFF);
  gl.uniformMatrix4fv(trace_spriteShader.getUniformLocation('P', gl), false, tmpMat);
  gl.uniformMatrix4fv(trace_spriteShader.getUniformLocation('MV', gl), false, cam.getTransformMatrix());
  gl.uniform3fv(trace_spriteShader.getUniformLocation('eyepos', gl), cam.getPos());
  gl.uniform3fv(trace_spriteShader.getUniformLocation('eyedir', gl), cam.forward());
  gl.uniform1f(trace_spriteShader.getUniformLocation('size', gl), 100);
  draw(gl, sprite, trace_spriteShader);
}

var last = null;
animate(gl, function (gl:WebGLRenderingContext, time:number) {

  control.move(time);

  var data = RT.drawTo(gl, trace);
  var sum = 0;
  var count = 0;
  for (var i = 0; i < 4 * RTSize * RTSize; i += 4){
    sum += data[i];
    if (data[i] != 0)
      count++;
  }
  // if (last == null) {
  //   last = sum;
  // }  else {
  //   var diff = last - sum;
  //   if (Math.abs(diff / sum) < 0.8){
  //     sum += diff / 2;
  //   }
  //   last = sum;
  // }
  pixel[0] = pixel[1] = pixel[2] = Math.min(sum / count, 255);
  pixel[3] = 0;
  tex1.putPiexl(x, y, pixel, gl);

  x++;
  if (x == size) {
    x = 0;
    last = null;
    y++;
    if (y == size) {
      y = 0;
    }
  }

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
  gl.uniform3fv(spriteShader.getUniformLocation('eyepos', gl), control.getCamera().getPos());
  gl.uniform3fv(spriteShader.getUniformLocation('eyedir', gl), control.getCamera().forward());
  gl.uniform1f(spriteShader.getUniformLocation('size', gl), 10);
  draw(gl, sprite, spriteShader);


  gl.activeTexture(gl.TEXTURE0);
  tex1.bind(gl);
  gl.useProgram(texShader.getProgram());
  GLM.mat4.ortho(tmpMat, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, 0, -0xFFFF, 0xFFFF);
  gl.uniformMatrix4fv(texShader.getUniformLocation('MVP', gl), false, tmpMat);
  gl.uniform1i(texShader.getUniformLocation('texture', gl), 0);
  draw(gl, screen, texShader);

});

gl.canvas.oncontextmenu = () => false;
