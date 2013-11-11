/// <reference path="defs/webgl.d.ts"/>

import shaders = require('./modules/shader');
import mb = require('./modules/meshbuilder');
import GLM = require('./libs_js/glmatrix');
import build = require('./modules/buildloader');
import buildstructs = require('./libs/buildstructs')
import data = require('./libs/dataviewstream');
import getter = require('./libs/getter');
import controller = require('./modules/controller2d');
import triangulator = require('./modules/triangulator');

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

var board = build.loadBuildMap(new data.DataViewStream(getter.get('resources/buildmaps/RCPD.map'), true));

var maxsector:buildstructs.Sector;
var maxsectorwalls = 0;
var sectors = board.sectors;
for (var i = 0; i < sectors.length; i++) {
  var sec = sectors[i];
  if (sec.wallnum > maxsectorwalls) {
    maxsector = sec;
    maxsectorwalls = sec.wallnum;
  }
}

class TriangulationContext {
  private contour:number[][];
  private holes = [];
  private i = 0;

  public addContour(contour:number[][]) {
    if (this.i == 0) {
      this.contour = contour;
    } else {
      this.holes.push(contour);
    }
    this.i++;
  }

  public getContour():number[][] {
    return this.contour;
  }

  public getHoles():number[][][] {
    return this.holes;
  }
}

function getContours(sector:buildstructs.Sector, walls:buildstructs.Wall[]):TriangulationContext {
  var i = 0;
  var pairs = [];
  while (i < sector.wallnum) {
    var firstwallIdx = i + sector.wallptr;
    var wall = walls[sector.wallptr + i];
    while (wall.point2 != firstwallIdx){
      wall = walls[wall.point2];
      i++;
    }
    i++;
    pairs.push([firstwallIdx, sector.wallptr+i]);
  }
  
  var ctx = new TriangulationContext();
  for (var i = 0; i < pairs.length; i++) {
    var contour = [];
    var pair = pairs[i];
    for (var j = pair[0]; j < pair[1]; j++) {
      contour.push([walls[j].x, walls[j].y]);
    }
    ctx.addContour(contour);
  }
  return ctx;
}
var walls = board.walls;



var builder = new mb.MeshBuilder();
var sectors = board.sectors;
for (var secnum in sectors) {
  var contour = getContours(sectors[secnum], walls);
  var tris = triangulator.triangulate(contour.getContour(), contour.getHoles());
  for (var i = 0; i < tris.length; i+=3) {
    builder.addTriangle([[tris[i][0], tris[i][1], 0], [tris[i+1][0], tris[i+1][1], 0], [tris[i+2][0], tris[i+2][1], 0]]);
  }
}

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
var control = new controller.Controller2D(gl);
control.setUnitsPerPixel(100);

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
