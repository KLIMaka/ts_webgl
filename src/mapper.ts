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
import CANV = require('./modules/pixel/canvas');
import AB = require('./libs/asyncbarrier');
import GET = require('./libs/getter');
import OBJ = require('./modules/formats/obj');

var ab = AB.create();
GET.preloadString('resources/models/floor.obj', ab.callback('floor'));
GET.preloadString('resources/models/corner2.obj', ab.callback('corner'));
GET.preloadString('resources/models/wall2.obj', ab.callback('wall'));
ab.wait((res) => start(res));

class Model {
  public vertexBuffers;
  public indexBuffer;
  public lengths:number[] = [];
  public offsets:number[] = [];

  constructor(objs:OBJ.ObjFile[], gl:WebGLRenderingContext) {
    var vtxs = [];
    var normals = [];
    var tcs = [];
    var off = 0;
    for (var o = 0; o < objs.length; o++) {
      var obj = objs[o];
      for (var i = 0; i < obj.tris.length; i++) {
        for (var v = 0; v < 3; v++) {
          var vidx = obj.tris[i][v][0]-1;
          var tidx = obj.tris[i][v][1]-1;
          var nidx = obj.tris[i][v][2]-1;
          vtxs.push(obj.vtxs[vidx][0], obj.vtxs[vidx][1], obj.vtxs[vidx][2]);
          normals.push(obj.normals[nidx][0], obj.normals[nidx][1], obj.normals[nidx][2]);
          tcs.push(obj.tcs[tidx][0], obj.tcs[tidx][1]);
        }
      }
      this.offsets.push(off);
      this.lengths.push(obj.tris.length*3);
      off += obj.tris.length*3*2;
    }

    this.vertexBuffers = {
      'aPos' : MB.wrap(gl, new Float32Array(vtxs), 3, gl.STATIC_DRAW),
      'aNorm' : MB.wrap(gl, new Float32Array(normals), 3, gl.STATIC_DRAW),
      'aTc' : MB.wrap(gl, new Float32Array(tcs), 2, gl.STATIC_DRAW),
    }
    this.indexBuffer = MB.genIndexBuffer(gl, off, [0, 1, 2]);
  }
}

function modelMatrix(x:number, y:number, ang:number) {
  var mat = GLM.mat4.create();
  mat = GLM.mat4.translate(mat, mat, GLM.vec3.fromValues(x, 0, y));
  mat = GLM.mat4.rotateY(mat, mat, MU.deg2rad(ang));
  return mat;
}

function start(res) {
var floor = OBJ.readObj(res.floor);
var wall = OBJ.readObj(res.wall);
var corner = OBJ.readObj(res.corner);

var gl = GL.createContext(1200, 800, {alpha:false});
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var model = new Model([corner, floor, wall], gl);
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