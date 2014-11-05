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
import raster = require('./modules/rasterizer');

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
  constructor(private mat:Mat) {}
  get(picnum:number) {return this.mat}
}

var traceContext = {
  MVP: GLM.mat4.create(),
  MV: GLM.mat4.create(),
  P: GLM.mat4.perspective(GLM.mat4.create(), MU.deg2rad(90), 1, 1, 0xFFFF),
  pos: null,
  dir: null,
  ms: new buildutils.MoveStruct(),
  processor: null,
  light: null
};

var traceBinder = new GL.UniformBinder();
traceBinder.addResolver('MVP', GL.mat4Setter,     ()=>traceContext.MVP);
traceBinder.addResolver('MV', GL.mat4Setter,      ()=>traceContext.MV);
traceBinder.addResolver('P', GL.mat4Setter,       ()=>traceContext.P);
traceBinder.addResolver('eyepos', GL.vec3Setter,  ()=>traceContext.pos);
traceBinder.addResolver('eyedir', GL.vec3Setter,  ()=>traceContext.dir);
traceBinder.addResolver('size', GL.float1Setter,  ()=>100);

function trace(gl:WebGLRenderingContext) {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var models = traceContext.processor.get(traceContext.ms, traceContext.dir);
  GL.draw(gl, models, traceBinder);
  GL.draw(gl, [traceContext.light], traceBinder);
}

var up_ = [0, 1, 0];
var right_ = [1, 0, 0];
function upVector(dir:number[]):number[] {
  var right = GLM.vec3.cross(GLM.vec3.create(), dir, up_);
  if (GLM.vec3.len(right) < 1e-10)
    right = GLM.vec3.cross(right, dir, right_);
  return GLM.vec3.cross(GLM.vec3.create(), dir, right);
}

var pixel = [0, 0, 0, 255];
function radiosity(gl:WebGLRenderingContext, rt:TEX.RenderTexture, pos:number[], dir:number[]):number[] {
  var center = GLM.vec3.add(GLM.vec3.create(), pos, dir);
  var up = upVector(dir);
  var MV = GLM.mat4.lookAt(traceContext.MV, pos, center, up);
  var P = traceContext.P;
  GLM.mat4.mul(traceContext.MVP, P, MV);
  traceContext.pos = pos;
  traceContext.dir = dir;
  traceContext.ms.x = pos[0];
  traceContext.ms.y = pos[2];

  var data = rt.drawTo(gl, trace);
  var sum = 0;
  var count = 0;
  for (var i = 0; i < rt.getWidth()*rt.getHeight()*4; i += 4){
    sum += data[i];
    if (data[i] != 0)
      count++;
  }
  pixel[0] = pixel[1] = pixel[2] = Math.min(sum / count, 255);
  return pixel;
}

var S = 4096*4;
class MyBoardBuilder implements buildutils.BoardBuilder {
  private builder:mb.MeshBuilder;
  private packer = new tcpack.Packer(S, S);
  private buf:number[] = [];
  private idxs:number[] = [];

  constructor() {
    var gl = WebGLRenderingContext;
    this.builder = new mb.MeshBuilderConstructor()
      .buffer('aPos', Float32Array, gl.FLOAT, 3)
      .buffer('aNorm', Float32Array, gl.FLOAT, 3)
      .buffer('aIdx', Uint8Array, gl.UNSIGNED_BYTE, 4, true)
      .buffer('aTc', Float32Array, gl.FLOAT, 2)
      .buffer('aLMTc', Float32Array, gl.FLOAT, 2)
      .buffer('aShade', Int8Array, gl.BYTE, 1)
      .index(Uint16Array, gl.UNSIGNED_SHORT)
      .build();
  }

  public addFace(type:number, verts:number[][], tcs:number[][], idx:number, shade:number) {
    var proj = MU.project3d(verts);
    var hull = tcpack.getHull(proj);
    var r = this.packer.pack(new tcpack.Rect(hull.maxx-hull.minx, hull.maxy-hull.miny));
    var lmtcs = [];
    for (var i = 0; i < verts.length; i++) {
      var u = (r.xoff+proj[i][0]-hull.minx)/S;
      var v = (r.yoff+proj[i][1]-hull.miny)/S;
      lmtcs.push([u, v]);
    }
    var normal = MU.normal(verts);

    this.builder.start(type)
      .attr('aNorm', normal)
      .attr('aIdx', MU.int2vec4(idx))
      .attr('aShade', [shade]);
    for (var i = 0; i < verts.length; i++){
      this.builder
        .attr('aTc', tcs[i])
        .attr('aLMTc', lmtcs[i])
        .vtx('aPos', verts[i]);

        this.buf.push(lmtcs[i][0]);
        this.buf.push(lmtcs[i][1]);
        this.buf.push(verts[i][0]);
        this.buf.push(verts[i][1]);
        this.buf.push(verts[i][2]);
        this.buf.push(normal[0]);
        this.buf.push(normal[1]);
        this.buf.push(normal[2]);
    }
    this.builder.end();
  }

  public getOffset(): number {
    return this.builder.offset() * 2;
  }

  public build(gl:WebGLRenderingContext):ds.DrawStruct {
    return this.builder.build(gl, null);
  }

  public bake(gl:WebGLRenderingContext, w:number, h:number):Uint8Array {
    var canvas:HTMLCanvasElement = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    var img = ctx.getImageData(0, 0, w, h);
    var RT = new TEX.RenderTexture(128, 128, gl);
    var rast = new raster.Rasterizer(img, (attrs:number[]) => {
      //return radiosity(gl, RT, [attrs[2], attrs[3], attrs[4]], [attrs[5], attrs[6], attrs[7]]);
      return [255, 0, 0, 255];
    });
    rast.bindAttributes(0, this.buf, 8);
    rast.drawTriangles(this.builder.idxbuf().buf(), 0, this.builder.idxbuf().length());
    ctx.putImageData(img, 0, 0);
    return new Uint8Array(img.data);
  }
}

var MAP = 'resources/buildmaps/cube.map';

getter.loader
.load(MAP)
.loadString('resources/shaders/trace_base.vsh')
.loadString('resources/shaders/trace_base.fsh')
.loadString('resources/shaders/trace_sprite.vsh')
.loadString('resources/shaders/trace_sprite.fsh')
.finish(() => {

var gl = GL.createContext(w, h);
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get(MAP), true));

base = new TEX.DrawTexture(1, 1, gl);
var trace_baseShader = shaders.createShaderFromSrc(gl, getter.getString('resources/shaders/trace_base.vsh'), getter.getString('resources/shaders/trace_base.fsh'));
var trace_spriteShader = shaders.createShaderFromSrc(gl, getter.getString('resources/shaders/trace_sprite.vsh'), getter.getString('resources/shaders/trace_sprite.fsh'));
var size = 32;
var builder = new MyBoardBuilder();
var processor = new buildutils.BoardProcessor(board).build(gl, new MF(new Mat(trace_baseShader)), builder);
var control = new controller.Controller3D(gl);

traceContext.processor = processor;
traceContext.light = buildSprite(board.sprites[0], gl, trace_spriteShader);
var lm = builder.bake(gl, 128, 128);
var tex1 = new TEX.Texture(128, 128, gl, lm);

var base_shader = shaders.createShader(gl, 'resources/shaders/base');
builder = new MyBoardBuilder();
var processor1 = new buildutils.BoardProcessor(board).build(gl, new MF(new Mat(base_shader, {lm:tex1})), builder);
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

var ms = new buildutils.MoveStruct();
GL.animate(gl, function (gl:WebGLRenderingContext, time:number) {

  control.move(time);
  ms.x = control.getCamera().getPos()[0];
  ms.y = control.getCamera().getPos()[2];

  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  var models = processor1.get(ms, control.getCamera().forward());
  GL.draw(gl, models, binder);
  // GL.draw(gl, [light], binder);
  GL.draw(gl, [screen], screenBinder);
});

gl.canvas.oncontextmenu = () => false;

});
