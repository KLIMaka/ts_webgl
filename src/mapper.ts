import GL = require('./modules/gl');
import TEX = require('./modules/textures');
import MU = require('./libs/mathutils');
import CTRL = require('./modules/controller2d');
import CTRL3 = require('./modules/controller3d');
import GLM = require('./libs_js/glmatrix');
import BATCHER = require('./modules/batcher');
import SHADERS = require('./modules/shaders');
import MB = require('./modules/meshbuilder');
import UI = require('./modules/ui/ui');
import AB = require('./libs/asyncbarrier');
import GET = require('./libs/getter');
import OBJ = require('./modules/formats/obj');
import PP = require('./modules/pixelprovider');

class Tile {
  constructor(
    private length:number,
    private offset:number,
    private icon:PP.PixelProvider)
  {}
}

class Cell {
  constructor(
    private tileId:number,
    private ang:number=0)
  {}
}

class Layer {
  constructor(
    private objs:OBJ.ObjData,
    private tileset:Tile[],
    private cellW:number,
    private cellH:number)
  {}
}

var ab = AB.create();
GET.preloadString('resources/models/floor.obj', ab.callback('floor'));
GET.preloadString('resources/models/corner2.obj', ab.callback('corner'));
GET.preloadString('resources/models/wall2.obj', ab.callback('wall'));
ab.wait((res) => start(res));

function modelMatrix(x:number, y:number, ang:number) {
  var mat = GLM.mat4.create();
  mat = GLM.mat4.translate(mat, mat, GLM.vec3.fromValues(x, 0, y));
  mat = GLM.mat4.rotateY(mat, mat, MU.deg2rad(ang));
  return mat;
}

function start(res) {
var gl = GL.createContext(1200, 800, {alpha:false});
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var model = OBJ.loadObjs([res.corner, res.floor, res.wall], gl);
var shader = SHADERS.createShader(gl, 'resources/shaders/simple');
var ctrl = new CTRL3.Controller3D(gl);

var cmds = [
  BATCHER.shader, shader,
  BATCHER.vertexBuffers, model.vertexBuffers,
  BATCHER.indexBuffer, model.indexBuffer,
  BATCHER.uniforms, [
    'VP', BATCHER.setters.mat4, () => ctrl.getMatrix(),
    'LIGHT_DIR', BATCHER.setters.vec3, () => ctrl.getCamera().forward()
  ],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(0, 0, 0)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[0], model.offsets[0]],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(0, 10, 0)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[2], model.offsets[2]],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(0, 20, 90)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[0], model.offsets[0]],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(10, 20, 90)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[2], model.offsets[2]],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(20, 20, 180)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[0], model.offsets[0]],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(20, 10, 180)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[2], model.offsets[2]],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(20, 0, 270)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[0], model.offsets[0]],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(10, 0, 270)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[2], model.offsets[2]],
  BATCHER.uniforms, ['M', BATCHER.setters.mat4, modelMatrix(10, 10, 0)],
  BATCHER.drawCall, [gl.TRIANGLES, model.lengths[1], model.offsets[1]],
];

GL.animate(gl, (gl:WebGLRenderingContext, t:number) => {
  ctrl.move(t / 500);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  BATCHER.exec(cmds, gl);
});

}