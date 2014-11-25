import GL = require('./modules/gl');
import shaders = require('./modules/shaders');
import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import controller = require('./modules/controller3d');
import build = require('./modules/engines/build/loader');
import buildutils = require('./modules/engines/build/utils');
import buildstructs = require('./modules/engines/build/structs');
import DS = require('./modules/drawstruct');
import ART = require('./modules/engines/build/art');
import GRP = require('./modules/engines/build/grp');
import pixel = require('./modules/pixelprovider');
import TEX = require('./modules/textures');
import CFG = require('./libs/config');
import RFF = require('./modules/engines/build/rff');

var rffFile = 'resources/engines/blood/blood.rff';
var cfgFile = 'build.cfg';
var selectPass = false;

class Mat implements DS.Material {
  constructor(private baseShader:DS.Shader, private selectShader:DS.Shader, private tex:{[index:string]:DS.Texture}) {}
  getShader():DS.Shader {return selectPass ? this.selectShader : this.baseShader}
  getTexture(sampler:string):DS.Texture {return this.tex[sampler]}
}

class MF implements buildutils.MaterialFactory {
  private materials:DS.Material[] = [];
  
  constructor(private arts:ART.ArtFiles, private pal:Uint8Array, private baseShader:DS.Shader, private selectShader:DS.Shader, private gl:WebGLRenderingContext) {}

  get(picnum:number) {
    var mat = this.materials[picnum];
    if (mat != undefined)
      return mat;

    var info = this.arts.getInfo(picnum);
    var arr = new Uint8Array(info.w*info.h*4);
    var pp = pixel.axisSwap(pixel.fromPal(info.img, this.pal, info.w, info.h, 255, 255));
    pp.render(arr);
    mat = new Mat(this.baseShader, this.selectShader, {base:new TEX.TextureImpl(pp.getWidth(), pp.getHeight(), this.gl, arr)});

    this.materials[picnum] = mat;
    return mat;
  }
}

function getPlayerStart(board:buildstructs.Board):buildstructs.Sprite {
  for (var i = 0; i < board.numsprites; i++) {
    var sprite = board.sprites[i];
    if (sprite.lotag == 1)
      return sprite;
  }
  return null;
}

function render(cfg:any, map:ArrayBuffer, artFiles:ART.ArtFiles, pal:Uint8Array) {
  var gl = GL.createContext(cfg.width, cfg.height, {alpha:false, antialias:false});
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  var board = build.loadBuildMap(new data.DataViewStream(map, true));
  var processor = new buildutils.BoardProcessor(board);
  var baseShader = shaders.createShader(gl, 'resources/shaders/build_base');
  var selectShader = shaders.createShader(gl, 'resources/shaders/select');
  var mf = new MF(artFiles, pal, baseShader, selectShader, gl);
  processor.build(gl, mf);

  var control = new controller.Controller3D(gl);
  var playerstart = getPlayerStart(board);
  var ms = new buildutils.MoveStruct();
  ms.sec = playerstart.sectnum;
  ms.x = playerstart.x;
  ms.y = playerstart.y;
  ms.z = playerstart.z;

  var activeIdx = 0;

  var binder = new GL.UniformBinder();
  binder.addResolver('MVP', GL.mat4Setter,       ()=>control.getMatrix());
  binder.addResolver('eyepos', GL.vec3Setter,    ()=>control.getCamera().getPos());
  binder.addResolver('eyedir', GL.vec3Setter,    ()=>control.getCamera().forward());
  binder.addResolver('activeIdx', GL.int1Setter, ()=>activeIdx);

  GL.animate(gl,(gl:WebGLRenderingContext, time:number) => {

    if (cfg.select) {
      //select draw
      selectPass = true;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var models = processor.get(ms, control.getCamera().forward());
      GL.draw(gl, models, binder);

      var id = GL.readId(gl, control.getX(), control.getY());
      activeIdx = id;
      if (control.isClick()) {
        console.log(processor.getByIdx(activeIdx));
        console.log(control.getCamera());
      }
    }

    // actual draw
    selectPass = false;
    gl.clearColor(0.1, 0.3, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var models = processor.get(ms, control.getCamera().forward());
    //var pos = control.getCamera().getPos();
    //ms.x = pos[0]; ms.y = pos[2]; ms.sec = undefined;
    //var models = processor.get(ms, control.getCamera().forward());
    console.log(models.length);
    GL.draw(gl, models, binder);

    control.move(time);
    var d = control.move1(time);
    buildutils.move(board, ms, d[0], d[1]);
    buildutils.fall(board, ms, time*8192*4)
    control.getCamera().setPosXYZ(ms.x, ms.z/-16 + 1024, ms.y);
  });

  gl.canvas.oncontextmenu = () => false;
}

var path = 'resources/engines/blood/';
var artNames = [];
for (var a = 0; a < 18; a++) {
  artNames[a] = path + 'TILES0'+("00" + a).slice(-2)+'.ART';
  getter.loader.load(artNames[a]);
}

getter.loader
.loadString(cfgFile)
.load(rffFile)
.finish(() => {

var cfg = CFG.create(getter.getString(cfgFile));
var rff = RFF.create(getter.get(rffFile));
var pal = rff.get('BLOOD.PAL');
var arts = [];
for (var a = 0; a < 18; a++)
  arts.push(ART.create(new data.DataViewStream(getter.get(artNames[a]), true)));
var artFiles = ART.createArts(arts);

getter.preload(cfg.map, (map:ArrayBuffer) => render(cfg, map, artFiles, pal))

});