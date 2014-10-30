import GL = require('./modules/gl');
import shaders = require('./modules/shaders');
import mb = require('./modules/meshbuilder');
import ds = require('./modules/drawstruct');
import getter = require('./libs/getter');
import build = require('./modules/engines/build/loader');
import data = require('./libs/dataviewstream');
import controller = require('./modules/controller3d');
import buildutils = require('./modules/engines/build/utils');
import buildstructs = require('./modules/engines/build/structs');
import GLM = require('libs_js/glmatrix');
import TEX = require('./modules/textures');
import camera = require('./modules/camera');
import MU = require('./libs/mathutils');
import tcpack = require('./modules/texcoordpacker');

var w = 600;
var h = 400;

var base = null;
class Mat implements ds.Material {
  constructor(private shader:ds.Shader, private tex:{[index:string]:ds.Texture} = {}) {}
  getShader():ds.Shader {return this.shader}
  getTexture(sampler:string):ds.Texture {return (sampler=='base' && this.tex[sampler]==undefined) ? base : this.tex[sampler]}
}


var SCALE = -16;
function buildSprite(sprite:buildstructs.Sprite, gl:WebGLRenderingContext, shader:ds.Shader):ds.DrawStruct {
  var builder = new mb.MeshBuilderConstructor(4)
    .buffer('pos', Float32Array, gl.FLOAT, 3)
    .buffer('norm', Float32Array, gl.FLOAT, 2)
    .index(Uint16Array, gl.UNSIGNED_SHORT)
    .build();

  var x = sprite.x;
  var y = sprite.y;
  var z = sprite.z / SCALE;

  builder.start(mb.QUADS)
    .attr('norm', [-1,  1]).vtx('pos', [x, z, y])
    .attr('norm', [ 1,  1]).vtx('pos', [x, z, y])
    .attr('norm', [ 1, -1]).vtx('pos', [x, z, y])
    .attr('norm', [-1, -1]).vtx('pos', [x, z, y])
    .end();
  return builder.build(gl, new Mat(shader));
}

function buildScreen(gl:WebGLRenderingContext, shader:ds.Shader, tex:ds.Texture) {
  var builder = new mb.MeshBuilderConstructor(4)
    .buffer('pos', Float32Array, gl.FLOAT, 2)
    .buffer('norm', Float32Array, gl.FLOAT, 2)
    .index(Uint16Array, gl.UNSIGNED_SHORT)
    .build();

  builder.start(mb.QUADS)
    .attr('norm', [0, 0]).vtx('pos', [0, 0])
    .attr('norm', [1, 0]).vtx('pos', [100, 0])
    .attr('norm', [1, 1]).vtx('pos', [100, 100])
    .attr('norm', [0, 1]).vtx('pos', [0, 100])
    .end();
  return builder.build(gl, new Mat(shader, {texture:tex}));
}

class MF implements buildutils.MaterialFactory {
  private mat:ds.Material = null;
  constructor(private shader:ds.Shader, private wallmat:Mat) {this.mat = new Mat(shader)}
  get(picnum:number) {return picnum==9999 ? this.wallmat : this.mat}
}

var MAP = 'resources/buildmaps/cube.map';

getter.loader
.load(MAP)
.finish(() => {

var gl = GL.createContext(w, h);
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get(MAP), true));
var sect = board.sectors[0];
var wall1 = board.walls[sect.wallptr];
var wall2 = board.walls[wall1.point2];
wall1.picnum = 9999;
wall1.xrepeat = 4;
wall1.yrepeat = 1;


base = new TEX.DrawTexture(1, 1, gl);
var baseShader = shaders.createShader(gl, 'resources/shaders/base');
var size = 32;
var tex1 = new TEX.DrawTexture(size, size, gl);
var model = new buildutils.BoardProcessor(board).build(gl, new MF(baseShader, new Mat(baseShader, {base:tex1}))).getAll();
var control = new controller.Controller3D(gl);
var pixel = new Uint8Array(4);
var trace_baseShader = shaders.createShader(gl, 'resources/shaders/trace_base');
var trace_spriteShader = shaders.createShader(gl, 'resources/shaders/trace_sprite');

var light = buildSprite(board.sprites[0], gl, shaders.createShader(gl, 'resources/shaders/sprite'));
var screen = buildScreen(gl, shaders.createShader(gl, 'resources/shaders/base1'), tex1);


var binder = new GL.UniformBinder();
binder.addResolver('MVP', GL.mat4Setter,     ()=>control.getMatrix());
binder.addResolver('MV', GL.mat4Setter,      ()=>control.getModelViewMatrix());
binder.addResolver('P', GL.mat4Setter,       ()=>control.getProjectionMatrix());
binder.addResolver('eyepos', GL.vec3Setter,  ()=>control.getCamera().getPos());
binder.addResolver('eyedir', GL.vec3Setter,  ()=>control.getCamera().forward());
binder.addResolver('size', GL.float1Setter,  ()=>10);

var screenBinder = new GL.UniformBinder();
var screenMat = GLM.mat4.ortho(GLM.mat4.create(), 0, w, h, 0, -0xFFFF, 0xFFFF);
screenBinder.addResolver('MVP', GL.mat4Setter, ()=>screenMat);


var x = 0;
var y = 0;

var step = 4096 / size;
var RTSize = 128;
var RT = new TEX.RenderTexture(RTSize, RTSize, gl);
var fov = 100;

var traceContext = {
  dx: GLM.vec3.create(),
  dy: GLM.vec3.create(),
  npos: GLM.vec3.create(),
  planeVec: GLM.vec3.normalize(GLM.vec3.create(), GLM.vec3.fromValues(wall2.x - wall1.x, 0, wall2.y - wall2.y)),
  start: GLM.vec3.fromValues(wall1.x, sect.ceilingz / SCALE, wall1.y),
  dVec: GLM.vec3.fromValues(0, -1, 0),
  cam: new camera.Camera(0, 0, 0, 0, 180),
  mat: GLM.mat4.create(),
  pmat: GLM.mat4.perspective(GLM.mat4.create(), MU.deg2rad(fov), 1, 1, 0xFFFF),
};

var traceBinder = new GL.UniformBinder();
traceBinder.addResolver('MVP', GL.mat4Setter, ()=>traceContext.mat);
traceBinder.addResolver('MV', GL.mat4Setter,      ()=>traceContext.cam.getTransformMatrix());
traceBinder.addResolver('P', GL.mat4Setter,       ()=>traceContext.pmat);
traceBinder.addResolver('eyepos', GL.vec3Setter,  ()=>traceContext.cam.getPos());
traceBinder.addResolver('eyedir', GL.vec3Setter,  ()=>traceContext.cam.forward());
traceBinder.addResolver('size', GL.float1Setter,  ()=>100);

function init(x: number, y:number, ctx:any) {
  GLM.vec3.scale(ctx.dx, ctx.planeVec, x * step);
  GLM.vec3.scale(ctx.dy, ctx.dVec, y * step);
  GLM.vec3.add(ctx.npos, ctx.start, ctx.dx);
  GLM.vec3.add(ctx.npos, ctx.npos, ctx.dy);
  ctx.cam.setPos(ctx.npos);

  GLM.mat4.perspective(ctx.mat, MU.deg2rad(fov), 1, 1, 0xFFFF);
  GLM.mat4.mul(ctx.mat, ctx.mat, ctx.cam.getTransformMatrix());
}


function trace(gl:WebGLRenderingContext) {
  init(x, y, traceContext);
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  GL.draw(gl, model, traceBinder);
  GL.draw(gl, [light], traceBinder);
}

var last = null;
GL.animate(gl, function (gl:WebGLRenderingContext, time:number) {

  control.move(time);

  var data = RT.drawTo(gl, trace);
  var sum = 0;
  var count = 0;
  for (var i = 0; i < 4 * RTSize * RTSize; i += 4){
    sum += data[i];
    if (data[i] != 0)
      count++;
  }
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

  GL.draw(gl, model, binder);
  GL.draw(gl, [light], binder);
  GL.draw(gl, [screen], screenBinder);
});

gl.canvas.oncontextmenu = () => false;

});
