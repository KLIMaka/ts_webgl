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

var w = 600;
var h = 400;
var MAP = 'resources/buildmaps/doly.map';

function load(file:string):string {
  return getter.getString(file);
}

getter.loader
.load(MAP)
.loadString('resources/shaders/base.vsh')
.loadString('resources/shaders/base.fsh')
.finish(() => {

var SCALE = -16;
var gl = GL.createContext(w, h);
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get(MAP), true));
var model = buildutils.buildBoard(board, gl);
var baseShader = shaders.createShader(gl, load('resources/shaders/base.vsh'), load('resources/shaders/base.fsh'), ['MVP', 'eyedir', 'eyepos']);
var control = new controller.Controller3D(gl);

var binder = new GL.UniformBinder();
binder.addResolver('MVP', GL.mat4Setter, ()=>control.getMatrix());
binder.addResolver('eyepos', GL.vec3Setter, ()=>control.getCamera().getPos());
binder.addResolver('eyedir', GL.vec3Setter, ()=>control.getCamera().forward());

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

GL.animate(gl,(gl:WebGLRenderingContext, time:number) => {

  control.move(time);

  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  binder.bind(gl, baseShader);
  draw(gl, model, baseShader);
});

gl.canvas.oncontextmenu = () => false;

});