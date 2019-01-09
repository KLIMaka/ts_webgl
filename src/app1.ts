import GL = require('./modules/gl');
import shaders = require('./modules/shaders');
import mb = require('./modules/meshbuilder');
import ds = require('./modules/drawstruct');
import getter = require('./libs/getter');
import build = require('./modules/engines/build/loader');
import builder_ = require('./modules/engines/build/builder');
import data = require('./libs/dataviewstream');
import controller = require('./modules/controller3d');
import buildutils = require('./modules/engines/build/utils');
import buildstructs = require('./modules/engines/build/structs');
import GLM = require('./libs_js/glmatrix');
import TEX = require('./modules/textures');
import camera = require('./modules/camera');
import MU = require('./libs/mathutils');
import VEC = require('./libs/vecmath');
import IU = require('./libs/imgutils');
import tcpack = require('./modules/texcoordpacker');
import raster = require('./modules/rasterizer');
import AB = require('./libs/asyncbarrier');
import RNG = require('./modules/random');

var w = 1024;
var h = 768;
var LM_SCALE = 4096*10;
var LM_SIZE = 128;

var base = null;
class Material implements ds.Material {
  constructor(private shader:ds.Shader, private tex:{[index:string]:ds.Texture} = {}) {}
  getShader():ds.Shader {return this.shader}
  getTexture(sampler:string):ds.Texture {return (sampler=='base' && this.tex[sampler]==undefined) ? base : this.tex[sampler]}
}
function createMaterial(shader:ds.Shader, tex:{[index:string]:ds.Texture} = {}): Material {
  return new Material(shader, tex);
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
  return builder.build(gl, createMaterial(shader));
}

function buildScreen(gl:WebGLRenderingContext, shader:ds.Shader, tex:ds.Texture) {
  var builder = new mb.MeshBuilderConstructor(4)
    .buffer('pos', Float32Array, gl.FLOAT, 2)
    .buffer('norm', Float32Array, gl.FLOAT, 2)
    .index(Uint16Array, gl.UNSIGNED_SHORT)
    .build();

  builder.start(mb.QUADS)
    .attr('norm', [0, 0]).vtx('pos', [0, 0])
    .attr('norm', [1, 0]).vtx('pos', [256, 0])
    .attr('norm', [1, 1]).vtx('pos', [256, 256])
    .attr('norm', [0, 1]).vtx('pos', [0, 256])
    .end();
  return builder.build(gl, createMaterial(shader, {texture:tex}));
}

class SimpleMateralFactory implements builder_.MaterialFactory {
  constructor(private mat:Material) {}
  solid(tex:ds.Texture) {return this.mat}
  sprite(tex:ds.Texture) {return this.mat}
}


class NullArtProvider implements builder_.ArtProvider {
  private tex:ds.Texture = new TEX.TextureStub(1,1);
  get(picnum:number): ds.Texture { return this.tex; }
  getInfo(picnum:number):number { return 0; }
}
var nullArtProvider = new NullArtProvider();

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
traceBinder.addResolver('size', GL.float1Setter,  ()=>200);

function trace(gl:WebGLRenderingContext) {
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  var models = traceContext.processor.get(traceContext.ms, traceContext.dir);
  GL.draw(gl, models, traceBinder);
  GL.draw(gl, [traceContext.light], traceBinder);
}

var up_ = [0, 1, 0];
var right_ = [1, 0, 0];
function rightVector(dir:number[]):number[] {
  var right = GLM.vec3.cross(GLM.vec3.create(), dir, up_);
  if (GLM.vec3.len(right) < 1e-10)
    right = GLM.vec3.cross(right, dir, right_);
  return right;
}

function upVector(dir:number[], right:number[]):number[] {
  return GLM.vec3.cross(GLM.vec3.create(), dir, right);
}

function gather(gl:WebGLRenderingContext, rt:TEX.RenderTexture, pos:number[], dir:number[], up:number[]):number[] {
  var center = GLM.vec3.add(GLM.vec3.create(), pos, dir);
  var P = traceContext.P;
  var MV = GLM.mat4.lookAt(traceContext.MV, pos, center, up);
  var MVP = GLM.mat4.mul(traceContext.MVP, P, MV);

  var data = rt.drawTo(gl, trace);
  var sum = 0;
  var count = 0;
  for (var i = 0; i < rt.getWidth()*rt.getHeight()*4; i += 4){
    sum += data[i];
    count += data[i] != 0 ? 1 : 0 
  }
  return [sum, count];
}

var pixel = [0, 0, 0, 255];
function radiosity(gl:WebGLRenderingContext, rt:TEX.RenderTexture, pos:number[], dir:number[]):number[] {
  traceContext.pos = pos;
  traceContext.dir = dir;
  traceContext.ms.x = pos[0];
  traceContext.ms.y = pos[2];
  
  var right = rightVector(dir);
  var up = upVector(dir, right);
  var right_ = GLM.vec3.negate(GLM.vec3.create(), right);
  var up_ = GLM.vec3.negate(GLM.vec3.create(), up);

  var setup = [
    [dir, up],
    [right, dir],
    [right_, dir],
    [up, dir],
    [up_, dir]
  ];

  var g = [0, 0];
  for (var i = 0; i < setup.length; i++) {
    var s = setup[i];
    var res = gather(gl, rt, pos, s[0], s[1]);
    g[0] += res[0]; g[1] += res[1];
  }
  var c = g[1] == 0 ? 0 : Math.min(g[0]/g[1], 255);
  pixel[0] = pixel[1] = pixel[2] = c;
  return pixel;
}

function blendLM(lm:Uint8Array, w:number, h:number, lm1:Uint8Array=null):Uint8Array {
  if (lm1 == null)
    return lm;
  var ret = new Uint8Array(w*h*4);
  for (var i = 0; i < w*h*4; i +=4) {
    var c = lm[i] * 0.6 + lm1[i] * 0.4;
    ret[i] = ret[i+1] = ret[i+2] = c;
    ret[i+3] = lm[i+3];
  }
  return ret;
}

function processLM(lm:Uint8Array, w:number, h:number, lm1:Uint8Array=null):Uint8Array {
  var ret = new Uint8Array(w*h*4);
  var dw = 4;
  var dh = w*4;
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      var idx = (y*w+x)*4;
      var c = lm[idx];
      var a = lm[idx+3];
      if (a == 0) {
        var sum = 0;
        var count = 0;
        if (x > 0) {sum += lm[idx-dw]; count += lm[idx-dw+3]!=0?1:0;}
        if (x < w-1) {sum += lm[idx+dw]; count += lm[idx+dw+3]!=0?1:0;}
        if (y > 0) {sum += lm[idx-dh]; count += lm[idx-dh+3]!=0?1:0;}
        if (y < h-1) {sum += lm[idx+dh]; count += lm[idx+dh+3]!=0?1:0;}
        if (x > 0 && y > 0) {sum += lm[idx-dw-dh]; count += lm[idx-dw-dh+3]!=0?1:0;}
        if (x > 0 && y < h-1) {sum += lm[idx-dw+dh]; count += lm[idx-dw+dh+3]!=0?1:0;}
        if (x < w-1 && y > 0) {sum += lm[idx+dw-dh]; count += lm[idx+dw-dh+3]!=0?1:0;}
        if (x < w-1 && y < h-1) {sum += lm[idx+dw+dh]; count += lm[idx+dw+dh+3]!=0?1:0;}
        c = sum / count;
      }
      c = c*(lm1==null ? 1 : 0.6) + (lm1==null ? 0 : lm1[idx])*0.4;
      ret[idx] = ret[idx+1] = ret[idx+2] = c;
      ret[idx+3] = a == 0 ? 0 : 255;
    }
  }
  return ret;
}

class MyBoardBuilder implements builder_.BoardBuilder {
  private builder:mb.MeshBuilder;
  private packer = new tcpack.Packer(LM_SCALE, LM_SCALE, LM_SCALE/LM_SIZE, LM_SCALE/LM_SIZE);
  private buf:number[] = [];
  private idxs:number[] = [];
  private vtxBuf:ds.VertexBuffer[];
  private idxBuf:ds.IndexBuffer;
  private mode:number;
  private off = 0;
  private len = 0;

  constructor(gl:WebGLRenderingContext) {
    this.builder = new mb.MeshBuilderConstructor()
      .buffer('aPos', Float32Array, gl.FLOAT, 3)
      .buffer('aNorm', Float32Array, gl.FLOAT, 3)
      .buffer('aIdx', Uint8Array, gl.UNSIGNED_BYTE, 4, true)
      .buffer('aTc', Float32Array, gl.FLOAT, 2)
      .buffer('aLMTc', Float32Array, gl.FLOAT, 2)
      .buffer('aShade', Int8Array, gl.BYTE, 1)
      .index(Uint16Array, gl.UNSIGNED_SHORT)
      .build();

    var tmp = this.builder.build(gl, null);
    this.vtxBuf = tmp.getVertexBuffers();
    this.idxBuf = tmp.getIndexBuffer();
    this.mode = tmp.getMode();
  }

  private calcLmap(normal:number[], verts:number[][]):number[][] {
    var proj = VEC.project3d(verts, normal);
    var hull = tcpack.getHull(proj);
    var r = this.packer.pack(new tcpack.Rect(hull.maxx-hull.minx, hull.maxy-hull.miny));
    if (r == null)
      throw new Error("Can not pack face");
    var lmtcs = [];
    for (var i = 0; i < verts.length; i++) {
      var u = (r.xoff+proj[i][0]-hull.minx)/LM_SCALE;
      var v = (r.yoff+proj[i][1]-hull.miny)/LM_SCALE;
      lmtcs.push([u, v]);
    }
    return lmtcs;
  }

  private fillBuffer(lmtcs:number[], verts:number[], normal:number[]) {
    this.buf.push(lmtcs[0]);
    this.buf.push(lmtcs[1]);
    this.buf.push(verts[0]);
    this.buf.push(verts[1]);
    this.buf.push(verts[2]);
    this.buf.push(normal[0]);
    this.buf.push(normal[1]);
    this.buf.push(normal[2]);
  }

  public addFace(type:number, verts:number[][], tcs:number[][], idx:number, shade:number) {
    var normal = VEC.polygonNormal(verts);
    var lmtcs = this.calcLmap(normal, verts);
    this.builder.start(type)
      .attr('aNorm', normal)
      .attr('aIdx', MU.int2vec4(idx))
      .attr('aShade', [shade]);
    for (var i = 0; i < verts.length; i++){
      this.builder
        .attr('aTc', tcs[i])
        .attr('aLMTc', lmtcs[i])
        .vtx('aPos', verts[i]);
      this.fillBuffer(lmtcs[i], verts[i], normal);
    }
    VEC.release3d(normal);
    this.builder.end();
    this.len += (type == mb.QUADS ? (6*verts.length/4) : verts.length);
  }

  public getOffset(): number {
    return this.builder.offset() * 2;
  }

  public *bake(gl:WebGLRenderingContext, w:number, h:number, lm:TEX.DrawTexture, lmBaked:TEX.DrawTexture):IterableIterator<number> {
    var img = new Uint8Array(w*h*4);
    var bakedLm = null;
    var RT = new TEX.RenderTexture(64, 64, gl);
    var rast = new raster.Rasterizer(img, w, h, (attrs:number[]) => {
      return radiosity(gl, RT, [attrs[2], attrs[3], attrs[4]], [attrs[5], attrs[6], attrs[7]]);
    });

    for(;;) {
      rast.bindAttributes(0, this.buf, 8);
      rast.clear([0,0,0,0], 0);
      var iterator = rast.drawTriangles(this.builder.idxbuf().buf(), 0, this.builder.idxbuf().length());
      for(;;) {
        if (iterator.next().done)
          break;
        lm.putSubImage(0, 0, w, h, blendLM(img, w, h, bakedLm), gl);
        yield 0;
      }
      bakedLm = processLM(img, w, h, bakedLm);
      lmBaked.putSubImage(0, 0, w, h, bakedLm, gl);
    }
  }

  public addSprite(verts:number[][], pos:number[], tcs:number[][], idx:number, shade:number):void {  }

  public begin() {
    this.off = this.builder.offset()*2;
    this.len = 0;
  }

  public end(mat:ds.Material):ds.DrawStruct {
    return new mb.Mesh(mat, this.vtxBuf, this.idxBuf, this.mode, this.len, this.off);
  }

  public finish(gl:WebGLRenderingContext) {
    this.builder.build(gl, null);
  }
}

var ab = AB.create();
getter.preloadString('resources/shaders/trace_base.vsh', ab.callback("_"));
getter.preloadString('resources/shaders/trace_base.fsh', ab.callback("_"));
getter.preloadString('resources/shaders/trace_sprite.vsh', ab.callback("_"));
getter.preloadString('resources/shaders/trace_sprite.fsh', ab.callback("_"));
getter.preload('resources/buildmaps/cube.map', ab.callback("map"));
ab.wait((files) => {

var gl = GL.createContext(w, h);
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(files['map'], true));
var trace_baseShader = shaders.createShader(gl, 'resources/shaders/trace_base');
var trace_spriteShader = shaders.createShader(gl, 'resources/shaders/trace_sprite');
var base_shader = shaders.createShader(gl, 'resources/shaders/base');
var base1_shader = shaders.createShader(gl, 'resources/shaders/base1');

base = new TEX.DrawTexture(1, 1, gl);
var lm = new TEX.DrawTexture(LM_SIZE, LM_SIZE, gl, {filter:gl.LINEAR});
var lm_baked = new TEX.DrawTexture(LM_SIZE, LM_SIZE, gl, {filter:gl.LINEAR});

var traceBuilder = new MyBoardBuilder(gl);
var traceMaterialFactory = new SimpleMateralFactory(createMaterial(trace_baseShader, {lm:lm_baked}));
traceContext.processor = new builder_.BoardProcessor(board).build(gl, nullArtProvider, traceMaterialFactory, traceBuilder);
traceContext.light = buildSprite(board.sprites[0], gl, trace_spriteShader);
var rad = traceBuilder.bake(gl, LM_SIZE, LM_SIZE, lm, lm_baked);

var renderBuilder = new MyBoardBuilder(gl);
var renderMaterailFactory = new SimpleMateralFactory(createMaterial(base_shader, {lm:lm}));
var renderProcessor = new builder_.BoardProcessor(board).build(gl, nullArtProvider, renderMaterailFactory, renderBuilder);
var screen = buildScreen(gl, base1_shader, lm);


var control = new controller.Controller3D(gl);
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

  var models = renderProcessor.get(ms, control.getCamera().forward());
  GL.draw(gl, models, binder);
  GL.draw(gl, [traceContext.light], binder);
  GL.draw(gl, [screen], screenBinder);
  rad.next();
});

gl.canvas.oncontextmenu = () => false;

});
