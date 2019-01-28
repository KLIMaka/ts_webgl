import GL = require('./modules/gl');
import shaders = require('./modules/shaders');
import getter = require('./libs/getter');
import data = require('./libs/dataviewstream');
import MU = require('./libs/mathutils');
import controller = require('./modules/controller3d');
import bloodloader = require('./modules/engines/build/bloodloader');
import builder = require('./modules/engines/build/builder');
import BS = require('./modules/engines/build/structs');
import BU = require('./modules/engines/build/utils');
import DS = require('./modules/drawstruct');
import ART = require('./modules/engines/build/art');
import GRP = require('./modules/engines/build/grp');
import pixel = require('./modules/pixelprovider');
import TEX = require('./modules/textures');
import CFG = require('./libs/config');
import RFF = require('./modules/engines/build/rff');
import UI = require('./modules/ui/ui');
import IU = require('./libs/imgutils');
import browser = require('./libs/browser');
import BW = require('./modules/engines/build/buildwrapper');
import BGL = require('./modules/engines/build/gl/meshbuilder');

var rffFile = 'resources/engines/blood/BLOOD.RFF';
var cfgFile = 'build.cfg';
var drawSelect =  browser.getQueryVariable('select');
var selectPass = false;

class BuildMaterial implements DS.Material {
  constructor(private baseShader:DS.Shader, private selectShader:DS.Shader, private tex:{[index:string]:DS.Texture}) {}
  getShader():DS.Shader {return selectPass ? this.selectShader : this.baseShader}
  getTexture(sampler:string):DS.Texture {return this.tex[sampler]}
}

class BuildMaterialFactory implements builder.MaterialFactory {
  constructor(
    private baseShader:DS.Shader, 
    private selectShader:DS.Shader, 
    private spriteShader:DS.Shader, 
    private spriteSelectShader:DS.Shader){}

  solid(tex:DS.Texture) {
    return new BuildMaterial(this.baseShader, this.selectShader, {base:tex});
  }

  sprite(tex:DS.Texture) {
    return new BuildMaterial(this.spriteShader, this.spriteSelectShader, {base:tex});
  }
}

class BuildArtProvider implements builder.ArtProvider {
  private textures:DS.Texture[] = [];
  
  constructor(
    private arts:ART.ArtFiles, 
    private pal:Uint8Array,
    private gl:WebGLRenderingContext) {}

  get(picnum:number): DS.Texture {
    var tex = this.textures[picnum];
    if (tex != undefined)
      return tex;

    var info = this.arts.getInfo(picnum);
    if (info.h <= 0 || info.w <= 0)
       return this.get(0);
    var arr = new Uint8Array(info.w*info.h*4);
    var img = pixel.fromPal(info.img, this.pal, info.w, info.h, 255, 255);
    var pp = pixel.axisSwap(img);
    pp.render(arr);
    var repeat = MU.ispow2(pp.getWidth()) && MU.ispow2(pp.getHeight()) 
      ? WebGLRenderingContext.REPEAT 
      : WebGLRenderingContext.CLAMP_TO_EDGE;
    var filter = WebGLRenderingContext.NEAREST;
    tex = TEX.createTexture(pp.getWidth(), pp.getHeight(), this.gl, {filter:filter, repeat:repeat}, arr);

    this.textures[picnum] = tex;
    return tex;
  }

  getInfo(picnum:number):number {
    var info = this.arts.getInfo(picnum);
    return info.anum;
  }
}

function drawCompass(canvas:HTMLCanvasElement, eye:number[]) {
  var ctx = canvas.getContext('2d');
  var w = canvas.width;
  var h = canvas.height;
  var r = Math.min(w, h)/2 - 1;
  var x = r + eye[0]*r;
  var y = r + eye[2]*r;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(w/2, h/2, r, 0, Math.PI*2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI*2);
  ctx.fillStyle = 'black';
  ctx.fill();
}

var loadPanel = UI.verticalPanel('loadPanel');
document.body.appendChild(loadPanel.elem());
var loaders = {};
var index = [];
function progress(fname:string) {
  return (p:number) => {
    var loader = loaders[fname];
    if (loader == undefined) {
      loader = UI.progress(fname);
      loadPanel.add(loader);
      loaders[fname] = loader;
    }
    loader.setValue(p*100);
    if (p == 1)
      loader.css('display', 'none');
  }
}

var time = 0;
function tic():void {
  time = new Date().getTime();
}

function tac():number {
  return (new Date().getTime() - time) / 1000;
}

function render(cfg:any, map:ArrayBuffer, artFiles:ART.ArtFiles, pal:Uint8Array) {
  var gl = GL.createContext(cfg.width, cfg.height, {alpha:false, antialias:false});
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  var info = {
    'X:':0,
    'Y:':0,
    'Batches:':0,
    'Sector:':0,
    'Processing:':0,
    'Rendering:':0
  }

  var panel = UI.panel('Info');
  var props = UI.props(['X:', 'Y:', 'Batches:', 'Sector:', 'Processing:', 'Rendering:']);
  panel.append(props);
  var compass = IU.createEmptyCanvas(50, 50);
  panel.append(new UI.Element(compass));
  document.body.appendChild(panel.elem());

  var stream = new data.DataViewStream(map, true);
  var board = bloodloader.loadBloodMap(stream);
  var boardWrapper = new BW.BoardWrapper(board);
  var processor = new builder.BoardProcessor(board);
  var baseShader = shaders.createShader(gl, 'resources/shaders/build_base');
  var selectShader = shaders.createShader(gl, 'resources/shaders/select');
  var spriteShader = shaders.createShader(gl, 'resources/shaders/build_sprite');
  var spriteSelectShader = shaders.createShader(gl, 'resources/shaders/select_sprite');
  var mf = new BuildMaterialFactory(baseShader, selectShader, spriteShader, spriteSelectShader);
  var tp = new BuildArtProvider(artFiles, pal, gl);
  tic();
  processor.build(gl, tp, mf);
  console.log('parsing board: ' + tac() + 's');

  var control = new controller.Controller3D(gl);
  var playerstart = BU.getPlayerStart(board);
  var ms = new BU.MoveStruct();
  ms.sec = playerstart.sectnum;
  ms.x = playerstart.x;
  ms.y = playerstart.y;
  ms.z = playerstart.z;
  control.getCamera().setPosXYZ(ms.x, ms.z/-16 + 1024, ms.y);

  var activeIdx = 0;

  var binder = new GL.UniformBinder();
  binder.addResolver('MVP', GL.mat4Setter,       ()=>control.getMatrix());
  binder.addResolver('MV', GL.mat4Setter,        ()=>control.getModelViewMatrix());
  binder.addResolver('P', GL.mat4Setter,         ()=>control.getProjectionMatrix());
  binder.addResolver('eyepos', GL.vec3Setter,    ()=>control.getCamera().getPos());
  binder.addResolver('eyedir', GL.vec3Setter,    ()=>control.getCamera().forward());
  binder.addResolver('activeIdx', GL.int1Setter, ()=>activeIdx);

  BGL.init(gl, tp);

  GL.animate(gl,(gl:WebGLRenderingContext, time:number) => {

    // tic();
    // var models = processor.get(ms, control.getCamera().forward());
    // info['Processing:'] = tac();
    
    // if (drawSelect) {
    //   //select draw
    //   selectPass = true;
    //   gl.clearColor(0, 0, 0, 0);
    //   gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    //   GL.draw(gl, models, binder);

    //   var id = GL.readId(gl, control.getX(), control.getY());
    //   activeIdx = id;
    //   if (control.isClick()) {
    //     console.log(processor.getByIdx(activeIdx));
    //   }
    // }

    // actual draw
    // selectPass = false;
    gl.clearColor(0.1, 0.3, 0.1, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var pos = control.getCamera().getPos();
    ms.x = MU.int(pos[0]); ms.y = MU.int(pos[2]);

    tic();
    // GL.draw(gl, models, binder);
    BGL.draw(gl, boardWrapper, ms, control);
    info['Rendering:'] = tac();
    
    // info['Batches:'] = models.length;
    info['Sector:'] = ms.sec;
    info['X:'] = ms.x;
    info['Y:'] = ms.y;
    props.refresh(info);
    drawCompass(compass, control.getCamera().forward());

    control.move(time);
    // var d = control.move1(time);
    // BU.move1(board, ms, d[0], d[1]);
    // BU.fall(board, ms, time*8192*4)
    // control.getCamera().setPosXYZ(ms.x, ms.z/-16 + 1024, ms.y);
  });

  gl.canvas.oncontextmenu = () => false;
}

var path = 'resources/engines/blood/';
var artNames = [];
for (var a = 0; a < 18; a++) {
  artNames[a] = path + 'TILES0'+("00" + a).slice(-2)+'.ART';
  getter.loader.load(artNames[a], progress(artNames[a]));
}

getter.loader
.loadString(cfgFile)
.load(rffFile, progress(rffFile))
.finish(() => {

var cfg = CFG.create(getter.getString(cfgFile));
var rff = RFF.create(getter.get(rffFile));
var pal = rff.get('BLOOD.PAL');
var arts = [];
for (var a = 0; a < 18; a++)
  arts.push(ART.create(new data.DataViewStream(getter.get(artNames[a]), true)));
var artFiles = ART.createArts(arts);

var map = rff.get(browser.getQueryVariable('map')).buffer;
render(cfg, map, artFiles, pal);

});