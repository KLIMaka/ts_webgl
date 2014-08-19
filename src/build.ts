import GL = require('./modules/gl');
import shaders = require('./modules/shaders');
import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import controller = require('./modules/controller3d');
import build = require('./modules/engines/build/loader');
import buildutils = require('./modules/engines/build/utils');
import DS = require('./modules/drawstruct');
import ART = require('./modules/engines/build/art');
import GRP = require('./modules/engines/build/grp');
import pixel = require('./modules/pixelprovider');
import TEX = require('./modules/textures');

var w = 1024;
var h = 768;
var MAP = 'resources/buildmaps/blood_e3m1.MAP';
var selectPass = false;

class Mat implements DS.Material {
  constructor(private baseShader:DS.Shader, private selectShader:DS.Shader, private tex:{[index:string]:DS.Texture}) {}
  getShader():DS.Shader {return selectPass ? this.selectShader : this.baseShader}
  getTexture(sampler:string):DS.Texture {return this.tex[sampler]}
}

class MF implements buildutils.MaterialFactory {
  private materials:DS.Material[] = [];
  
  constructor(private arts:ART.ArtFiles, private pal:number[], private baseShader:DS.Shader, private selectShader:DS.Shader, private gl:WebGLRenderingContext) {}

  get(picnum:number) {
    var mat = this.materials[picnum];
    if (mat != undefined)
      return mat;

    var info = this.arts.getInfo(picnum);
    var arr = new Uint8Array(info.w*info.h*4);
    var pp = pixel.axisSwap(new pixel.RGBPalPixelProvider(info.img, this.pal, info.w, info.h, 255, 255));
    pp.render(arr);
    mat = new Mat(this.baseShader, this.selectShader, {base:new TEX.Texture(pp.getWidth(), pp.getHeight(), this.gl, arr)});

    this.materials[picnum] = mat;
    return mat;
  }
}

var path = 'resources/engines/blood/';
var artNames = [];
for (var a = 0; a < 18; a++) {
  artNames[a] = path + 'TILES0'+("00" + a).slice(-2)+'.ART';
  getter.loader.load(artNames[a]);
}

getter.loader
.load(MAP)
.load('resources/engines/blood/palette.dat')
.finish(() => {

var pal = GRP.createPalette(new data.DataViewStream(getter.get('resources/engines/blood/palette.dat'), true));
var arts = [];
for (var a = 0; a < 18; a++)
  arts.push(ART.create(new data.DataViewStream(getter.get(artNames[a]), true)));
var artFiles = ART.createArts(arts);

var gl = GL.createContext(w, h, {alpha:false, antialias:false});
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get(MAP), true));
var processor = new buildutils.BoardProcessor(board);
var baseShader = shaders.createShader(gl, 'resources/shaders/base');
var selectShader = shaders.createShader(gl, 'resources/shaders/select');
processor.build(gl, new MF(artFiles, pal, baseShader, selectShader, gl));


var control = new controller.Controller3D(gl);
var activeIdx = 0;

var binder = new GL.UniformBinder();
binder.addResolver('MVP', GL.mat4Setter, ()=>control.getMatrix());
binder.addResolver('eyepos', GL.vec3Setter, ()=>control.getCamera().getPos());
binder.addResolver('eyedir', GL.vec3Setter, ()=>control.getCamera().forward());
binder.addResolver('activeIdx', GL.int1Setter, ()=>activeIdx);

// control.getCamera().setPosXYZ(board.posx, board.posz*-16, board.posy);

GL.animate(gl,(gl:WebGLRenderingContext, time:number) => {

  control.move(time);

  // //select draw
  // selectPass = true;
  // gl.clearColor(0, 0, 0, 0);
  // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // var models = processor.get(control.getCamera().getPos(), control.getCamera().forward());
  // GL.draw(gl, models, binder);

  // var id = GL.readId(gl, control.getX(), control.getY());
  // activeIdx = id;

  // actual draw
  selectPass = false;
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  var models = processor.get(control.getCamera().getPos(), control.getCamera().forward());
  GL.draw(gl, models, binder);
});

gl.canvas.oncontextmenu = () => false;

});