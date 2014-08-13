import GL = require('./modules/gl');
import shaders = require('./modules/shader');
import material = require('./modules/material');
import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import controller = require('./modules/controller3d');
import build = require('./modules/engines/build/loader');
import buildutils = require('./modules/engines/build/utils');
import MU = require('./libs/mathutils');

var w = 600;
var h = 400;
var MAP = 'resources/buildmaps/newboard.MAP';

function load(file:string):string {
  return getter.getString(file);
}

getter.loader
.load(MAP)
.loadString('resources/shaders/base.vsh')
.loadString('resources/shaders/base.fsh')
.loadString('resources/shaders/select.vsh')
.loadString('resources/shaders/select.fsh')
.finish(() => {

var gl = GL.createContext(w, h, {alpha:false, antialias:false});
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get(MAP), true));
console.log(new buildutils.BoardProcessor(board));
var model = buildutils.buildBoard(board, gl);
var baseShader = shaders.createShader(gl, load('resources/shaders/base.vsh'), load('resources/shaders/base.fsh'));
var baseMaterial = new material.SimpleMaterial(baseShader, null);
var selectShader = shaders.createShader(gl, load('resources/shaders/select.vsh'), load('resources/shaders/select.fsh'));
var selectMaterial = new material.SimpleMaterial(selectShader, null);
var control = new controller.Controller3D(gl);
var activeIdx = 0;

var binder = new GL.UniformBinder();
binder.addResolver('MVP', GL.mat4Setter, ()=>control.getMatrix());
binder.addResolver('eyepos', GL.vec3Setter, ()=>control.getCamera().getPos());
binder.addResolver('eyedir', GL.vec3Setter, ()=>control.getCamera().forward());
binder.addResolver('activeIdx', GL.int1Setter, ()=>activeIdx);

control.getCamera().setPosXYZ(board.posx, board.posz*-16, board.posy);

GL.animate(gl,(gl:WebGLRenderingContext, time:number) => {

  control.move(time);

  //select draw
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  GL.draw(gl, model, selectMaterial, binder);

  var id = GL.readId(gl, control.getX(), control.getY());
  activeIdx = id;

  // actual draw
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  GL.draw(gl, model, baseMaterial, binder);
});

gl.canvas.oncontextmenu = () => false;

});