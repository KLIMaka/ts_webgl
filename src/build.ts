import GL = require('./modules/gl');
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
import DS = require('./modules/drawstruct');

var w = 1024;
var h = 768;
var MAP = 'resources/buildmaps/cube.map';

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

var gl = GL.createContext(w, h, {alpha:false});
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get(MAP), true));
var model = buildutils.buildBoard(board, gl);
var baseShader = shaders.createShader(gl, load('resources/shaders/base.vsh'), load('resources/shaders/base.fsh'), ['MVP', 'eyedir', 'eyepos', 'activeIdx']);
var selectShader = shaders.createShader(gl, load('resources/shaders/select.vsh'), load('resources/shaders/select.fsh'), ['MVP']);
var control = new controller.Controller3D(gl);
var activeIdx = [0,0,0,0];

var binder = new GL.UniformBinder();
binder.addResolver('MVP', GL.mat4Setter, ()=>control.getMatrix());
binder.addResolver('eyepos', GL.vec3Setter, ()=>control.getCamera().getPos());
binder.addResolver('eyedir', GL.vec3Setter, ()=>control.getCamera().forward());
binder.addResolver('activeIdx', GL.vec4Setter, ()=>activeIdx);

GL.animate(gl,(gl:WebGLRenderingContext, time:number) => {

  control.move(time);

  //select draw
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  binder.bind(gl, selectShader);
  GL.draw(gl, model, selectShader);

  var id = GL.readId(gl, control.getX(), control.getY());
  console.log(id);
  activeIdx = MU.int2vec4(id);
//
//  // actual draw
//  gl.clearColor(0.1, 0.3, 0.1, 1.0);
//
//  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
//  binder.bind(gl, baseShader);
//  GL.draw(gl, model, baseShader);
});

gl.canvas.oncontextmenu = () => false;

});