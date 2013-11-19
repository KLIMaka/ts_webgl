/// <reference path="defs/webgl.d.ts"/>

import shaders = require('./modules/shader');
import mb = require('./modules/meshbuilder');
import GLM = require('./libs_js/glmatrix');
import build = require('./modules/buildloader');
import data = require('./libs/dataviewstream');
import getter = require('./libs/getter');
import controller = require('./modules/controller3d');
import triangulator = require('./modules/triangulator');
import buildutils = require('./modules/buildutils');

var w = 600;
var h = 400;

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

var gl = setupGl();
// gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get('resources/buildmaps/doly.map'), true));
var walls = board.walls;
var sectors = board.sectors;

var builder = new mb.MeshBuilder();
sectors.forEach((sector) => {
  var contour = buildutils.getContours(sector, walls);
  var tris:number[][] = null;
  try {
    tris = triangulator.triangulate(contour.getContour(), contour.getHoles());
  } catch (e) {
    console.log(e);
  }
  if (tris == null)
    return;

  var i = 0;
  var scale = -16;
  var quads = [];
  while (i < sector.wallnum) {
    var wall = walls[sector.wallptr + i];
    var wall2 = walls[wall.point2];
    if (wall.nextwall == -1) {
      var a = [wall.x, sector.ceilingz / scale, wall.y];
      var b = [wall2.x, sector.ceilingz / scale, wall2.y];
      var c = [wall2.x, sector.floorz / scale, wall2.y];
      var d = [wall.x, sector.floorz / scale, wall.y];
      quads.push([a, b, c, d]);
    } else {
      var nextsector = sectors[wall.nextsector];

      if (sector.floorz > nextsector.floorz){
        var a = [wall.x, sector.floorz / scale, wall.y];
        var b = [wall2.x, sector.floorz / scale, wall2.y];
        var c = [wall2.x, nextsector.floorz / scale, wall2.y];
        var d = [wall.x, nextsector.floorz / scale, wall.y];
        quads.push([d, c, b, a]);
      }
      
      if (sector.ceilingz < nextsector.ceilingz){
        var a = [wall.x, sector.ceilingz / scale, wall.y];
        var b = [wall2.x, sector.ceilingz / scale, wall2.y];
        var c = [wall2.x, nextsector.ceilingz / scale, wall2.y];
        var d = [wall.x, nextsector.ceilingz / scale, wall.y];
        quads.push([d, c, b, a]);
      }
    }
    i++;
  }

  for (var i = 0; i < quads.length; i++) {
    builder.addQuad(quads[i]);
  }

  for (var i = 0; i < tris.length; i += 3) {
    var z = sector.floorz / scale;
    builder.addTriangle([
      [tris[i + 0][0], z, tris[i + 0][1]],
      [tris[i + 1][0], z, tris[i + 1][1]],
      [tris[i + 2][0], z, tris[i + 2][1]]
    ]);
    z = sector.ceilingz / scale;
    builder.addTriangle([
      [tris[i + 2][0], z, tris[i + 2][1]],
      [tris[i + 1][0], z, tris[i + 1][1]],
      [tris[i + 0][0], z, tris[i + 0][1]]
    ]);
  }
});

// var s = 0.1;
// builder.addQuad([[-s, s, s], [s, s, s], [s, -s, s],[-s, -s, s]]);
// builder.addQuad([[-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s]]);
// builder.addQuad([[-s, s, s], [-s, -s, s], [-s, -s, -s], [-s, s, -s]]);
// builder.addQuad([[s, s, -s], [s, -s, -s], [s, -s, s], [s, s, s]]);

// var builder = new mb.WireBuilder();
// for (var i = maxsector.wallptr; i < maxsector.wallptr+maxsector.wallnum; i++) {
// // for (var i = 0; i < walls.length; i++) {
//   var wall = walls[i];
//   var nwall = walls[wall.point2];
//   builder.addLine([wall.x, wall.y], [nwall.x, nwall.y]);
// }
// console.log('parsed ' + maxsector.wallnum + ' walls');

var model = builder.build(gl);
var shader = shaders.createShader(gl, load('resources/shaders/s.vsh'), load('resources/shaders/s.fsh'));
var control = new controller.Controller3D(gl);
//control.setUnitsPerPixel(100);

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

  control.move(time);
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(shader.getProgram());
  gl.uniformMatrix4fv(shader.getUniformLocation('MVP', gl), false, control.getMatrix());
  gl.uniform3fv(shader.getUniformLocation('eyepos', gl), control.getCamera().getPos());

  draw(gl, model, shader);
});

gl.canvas.oncontextmenu = () => false;
