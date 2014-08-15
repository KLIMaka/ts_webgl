import GL = require('./modules/gl');
import shaders = require('./modules/shaders');
import materials = require('./modules/materials');
import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import controller = require('./modules/controller3d');
import build = require('./modules/engines/build/loader');
import buildutils = require('./modules/engines/build/utils');
import MU = require('./libs/mathutils');
import DS = require('./modules/drawstruct');
import GRP = require('./modules/engines/build/grp');
import ART = require('./modules/engines/build/art');
import pixel = require('./modules/pixelprovider');
import TEX = require('./modules/textures');

var w = 600;
var h = 400;
var MAP = 'resources/buildmaps/newboard.MAP';
var RES = 'resources/engines/duke/duke3d.grp';

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
    mat = new materials.SelectionMaterial(this.baseShader, this.selectShader, {base:new TEX.Texture(pp.getWidth(), pp.getHeight(), this.gl, arr)});

    this.materials[picnum] = mat;
    return mat;
  }
}

getter.loader
.load(MAP)
.load(RES)
.finish(() => {

var grpFile = GRP.create(getter.get(RES));
var pal = GRP.createPalette(grpFile.get('PALETTE.DAT'));
var arts:ART.ArtFile[] = [];
for (var a = 0; a < 20; a++)
  arts.push(ART.create(grpFile.get('TILES0'+("00" + a).slice(-2)+'.ART')));
var artFiles = ART.createArts(arts);

var gl = GL.createContext(w, h, {alpha:false, antialias:false});
gl.enable(gl.CULL_FACE);
gl.enable(gl.DEPTH_TEST);

var board = build.loadBuildMap(new data.DataViewStream(getter.get(MAP), true));
var processor = new buildutils.BoardProcessor(board);
var baseShader = shaders.createShader(gl, 'resources/shaders/base');
var selectShader = shaders.createShader(gl, 'resources/shaders/select');

var models = processor.build(gl, new MF(artFiles, pal, baseShader, selectShader, gl));

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

  // //select draw
  // gl.clearColor(0, 0, 0, 0);
  // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // for (var i = 0; i < models.length; i++)
  //   GL.draw(gl, models[i], binder);

  // var id = GL.readId(gl, control.getX(), control.getY());
  // activeIdx = id;

  // actual draw
  gl.clearColor(0.1, 0.3, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  for (var i = 0; i < models.length; i++)
    GL.draw(gl, models[i], binder);
});

gl.canvas.oncontextmenu = () => false;

});