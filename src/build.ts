import * as GL from './modules/gl';
import * as getter from './libs/getter';
import * as data from './libs/dataviewstream';
import * as MU from './libs/mathutils';
import * as controller from './modules/controller3d';
import * as INPUT from './modules/input';
import * as bloodloader from './modules/engines/build/bloodloader';
import * as BS from './modules/engines/build/structs';
import * as BU from './modules/engines/build/utils';
import * as DS from './modules/drawstruct';
import * as ART from './modules/engines/build/art';
import * as TEX from './modules/textures';
import * as CFG from './libs/config';
import * as RFF from './modules/engines/build/rff';
import * as UI from './modules/ui/ui';
import * as IU from './libs/imgutils';
import * as browser from './libs/browser';
import * as RENDERER from './modules/engines/build/gl/boardrenderer';
import * as PROFILE from './modules/profiler';

var rffFile = 'resources/engines/blood/BLOOD.RFF';
var cfgFile = 'build.cfg';

class BuildArtProvider implements RENDERER.PalProvider {
  private textures:DS.Texture[] = [];
  private parallaxTextures:DS.Texture[] = [];
  private infos:ART.ArtInfo[] = [];
  private palTexture:DS.Texture = null;
  private pluTexture:DS.Texture = null;
  private parallaxPics = 16;
  
  constructor(
    private arts:ART.ArtFiles, 
    private pal:Uint8Array,
    private PLUs:Uint8Array[],
    private gl:WebGLRenderingContext) {}

  private createTexture(w:number, h:number, arr:Uint8Array):DS.Texture {
    var repeat = WebGLRenderingContext.CLAMP_TO_EDGE;
    var filter = WebGLRenderingContext.NEAREST;
    return TEX.createTexture(w, h, this.gl, {filter:filter, repeat:repeat}, arr, this.gl.LUMINANCE);
  }

  public get(picnum:number): DS.Texture {
    var tex = this.textures[picnum];
    if (tex != undefined)
      return tex;

    var info = this.arts.getInfo(picnum);
    if (info.h <= 0 || info.w <= 0)
       return this.get(0);
    var arr = this.axisSwap(info.img, info.h, info.w);
    tex = this.createTexture(info.w, info.h, arr);

    this.textures[picnum] = tex;
    return tex;
  }

  public getParallaxTexture(picnum:number):DS.Texture {
    var tex = this.parallaxTextures[picnum];
    if (tex != undefined)
      return tex;

    var infos:ART.ArtInfo[] = [];
    var axisSwapped:Uint8Array[] = [];
    for (var i = 0; i < this.parallaxPics; i++) {
      infos[i] = this.arts.getInfo(picnum+i);
      if (i != 0) {
        if (infos[i].w != infos[i-1].w || infos[i].h != infos[i-1].h) {
          console.warn('Invalid parallax texture #'+picnum);
          return this.get(0);
        }
      }
      axisSwapped[i] = this.axisSwap(infos[i].img, infos[i].h, infos[i].w);
    }
    var w = infos[0].w;
    var h = infos[0].h;
    var merged = this.mergeParallax(w, h, axisSwapped);
    tex = this.createTexture(w*this.parallaxPics, h, merged);

    this.parallaxTextures[picnum] = tex;
    return tex;
  }

  private mergeParallax(w:number, h:number, arrs:Uint8Array[]):Uint8Array {
    var result = new Uint8Array(w*h*this.parallaxPics);
    for (var y = 0; y < h; y++) {
      for (var i = 0; i < this.parallaxPics; i++) {
        for (var x = 0; x < w; x++) {
          result[y*w*this.parallaxPics+i*w+x] = arrs[i][y*w+x];
        }
      }
    }
    return result;
  }

  private axisSwap(data:Uint8Array, w:number, h:number):Uint8Array {
    var result = new Uint8Array(w*h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        result[x*h+y] = data[y*w+x];
      }
    }
    return result;
  }

  public getInfo(picnum:number):ART.ArtInfo {
    var info = this.infos[picnum];
    if (info == undefined) {
      info = this.arts.getInfo(picnum);
      this.infos[picnum] = info;
    }
    return info;
  }

  public getPalTexture():DS.Texture {
    if (this.palTexture == null)
      this.palTexture = TEX.createTexture(256, 1, this.gl, {filter:this.gl.NEAREST}, this.pal, this.gl.RGB, 3);
    return this.palTexture;
  }

  public getPluTexture():DS.Texture {
    if (this.pluTexture == null) {
      var tex = new Uint8Array(256*64*this.PLUs.length);
      for (var i = 0; i < this.PLUs.length; i++) {
        tex.set(this.PLUs[i], 256*64*i);
      }
      this.pluTexture = TEX.createTexture(256, 64*this.PLUs.length, this.gl, {filter:this.gl.NEAREST}, tex, this.gl.LUMINANCE);
    }
    return this.pluTexture;
  }
}

function drawCompass(canvas:HTMLCanvasElement, eye:number[]) {
  var ctx = canvas.getContext('2d');
  var w = canvas.width;
  var h = canvas.height;
  var r = Math.min(w, h)/2 - 1;
  var x = r + eye[0]*r;
  var y = r + eye[2]*r;
  var z = r - eye[1]*r;
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
  ctx.beginPath();
  ctx.arc(w, z, 5, 0, Math.PI*2);
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

function createMoveStruct(board:BS.Board, control:controller.Controller3D) {
  var playerstart = BU.getPlayerStart(board);
  var ms = new BU.MoveStruct();
  ms.sec = playerstart.sectnum;
  ms.x = playerstart.x;
  ms.y = playerstart.y;
  ms.z = playerstart.z;
  control.getCamera().setPositionXYZ(ms.x, ms.z/-16 + 1024, ms.y);
  return ms;
}

function createWall(x:number, y:number, p2:number, ns:number, nw:number) {
  var wall = new BS.Wall();
  wall.x = x; wall.y = y;
  wall.point2 = p2;
  wall.nextwall = nw;
  wall.nextsector = ns;
  wall.picnum = 0;
  wall.shade = 0;
  wall.pal = 0;
  wall.xrepeat = 8; wall.yrepeat = 8;
  wall.xpanning = 0; wall.ypanning = 0;
  wall.cstat = new BS.WallStats();
  return wall;
}

function createSector(wallptr:number, wallnum:number, floorz:number, ceilingz:number):BS.Sector {
  var sector = new BS.Sector();
  sector.wallptr = wallptr; sector.wallnum = wallnum;
  sector.ceilingz = ceilingz;
  sector.floorz = floorz;
  sector.ceilingstat = new BS.SectorStats(); sector.floorstat = new BS.SectorStats();
  sector.ceilingpicnum = wallptr; sector.floorpicnum = wallptr;
  sector.ceilingpal = 0; sector.floorpal = 0;
  sector.ceilingheinum = 0; sector.floorheinum = 0;
  sector.ceilingshade = wallptr; sector.floorshade = wallptr;
  sector.ceilingxpanning = 0; sector.floorxpanning = 0;
  sector.ceilingypanning = 0; sector.floorypanning = 0;
  return sector;
}

function createBoard() {
  var board = new BS.Board();
  board.walls = [];
  board.sectors = [];
  board.sprites = [];
  board.walls.push(createWall(0, 0, 1, -1, -1));
  board.walls.push(createWall(4096, 0, 2, -1, -1));
  board.walls.push(createWall(4096, 4096, 3, -1, -1));
  board.walls.push(createWall(0, 4096, 0, -1, -1));
  board.walls.push(createWall(1024, 1024, 5, 1, 11));
  board.walls.push(createWall(1024, 2048, 6, 1, 10));
  board.walls.push(createWall(2048, 2048, 7, 1, 9));
  board.walls.push(createWall(2048, 1024, 4, 1, 8));
  board.walls.push(createWall(1024, 1024, 9, 0, 7));
  board.walls.push(createWall(2048, 1024, 10, 0, 6));
  board.walls.push(createWall(2048, 2048, 11, 0, 5));
  board.walls.push(createWall(1024, 2048, 8, 0, 4));
  board.sectors.push(createSector(0, 8, 0, -16 * 4096));
  board.sectors.push(createSector(8, 4, 1024*-16, -16 * 3072));
  var sprite = new BS.Sprite();
  sprite.x = 1024;
  sprite.y = 1024;
  sprite.z = 0;
  sprite.picnum = 0;
  sprite.lotag = 1;
  board.sprites.push(sprite);
  return board;
}

function render(cfg:any, map:ArrayBuffer, artFiles:ART.ArtFiles, pal:Uint8Array, PLUs:Uint8Array[]) {
  var gl = GL.createContext(cfg.width, cfg.height, {alpha:false, antialias:true, stencil:true});

  var info = {
    'X:':0,
    'Y:':0,
    'Batches:':0,
    'Sector:':0,
    'Processing:':'',
    'Frame Time:':'',
    'Rendering:':'',
    'Sectors:':0,
    'Walls:':0,
    'Sprites:':0,
    'Buffer:':''
  }
  var props = UI.props(['X:', 'Y:', 'Batches:', 'Sector:', 'Processing:', 'Rendering:', 'Sectors:', 'Walls:', 'Sprites:', 'Frame Time:', 'Buffer:']);

  var panel = UI.panel('Info');
  panel.append(props);
  var compass = IU.createEmptyCanvas(50, 50);
  panel.append(new UI.Element(compass));
  document.body.appendChild(panel.elem());

  var stream = new data.DataViewStream(map, true);
  // var board = createBoard();
  var board = bloodloader.loadBloodMap(stream);
  console.log(board);
  var art = new BuildArtProvider(artFiles, pal, PLUs, gl);
  var control = new controller.Controller3D();
  INPUT.bind();
  control.setFov(75);
  var ms = createMoveStruct(board, control);

  RENDERER.init(gl, art, board, () => {
  
  GL.animate(gl,(gl:WebGLRenderingContext, time:number) => {
    
    var pos = control.getCamera().getPosition();
    ms.x = MU.int(pos[0]); ms.y = MU.int(pos[2]), ms.z = MU.int((pos[1])*-16);
    
    PROFILE.start();
    RENDERER.draw(gl, board, ms, control);
    PROFILE.endProfile()
    
    info['Rendering:'] = PROFILE.get('draw').time.toFixed(2)+'ms';
    info['Processing:'] = PROFILE.get('processing').time.toFixed(2)+'ms';
    info['Sectors:'] = PROFILE.get('processing').counts['sectors'];
    info['Walls:'] = PROFILE.get('processing').counts['walls'];
    info['Sprites:'] = PROFILE.get('processing').counts['sprites'];
    info['Sector:'] = ms.sec;
    info['X:'] = ms.x;
    info['Frame Time:'] = PROFILE.get(null).time.toFixed(2)+'ms';
    info['Y:'] = ms.y;
    info['Buffer:'] = (100 * PROFILE.get('processing').counts['buffer']).toFixed(2)+'%';
    props.refresh(info);
    drawCompass(compass, control.getCamera().forward());
    
    control.think(time);
    INPUT.postFrame();
  });

  gl.canvas.oncontextmenu = () => false;
  });

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

var PLUs = [
  rff.get('NORMAL.PLU'),
  rff.get('SATURATE.PLU'),
  rff.get('BEAST.PLU'),
  rff.get('TOMMY.PLU'),
  rff.get('SPIDER3.PLU'),
  rff.get('GRAY.PLU'),
  rff.get('GRAYISH.PLU'),
  rff.get('SPIDER1.PLU'),
  rff.get('SPIDER2.PLU'),
  rff.get('FLAME.PLU'),
  rff.get('COLD.PLU'),
  rff.get('P1.PLU'),
  rff.get('P2.PLU'),
  rff.get('P3.PLU'),
  rff.get('P4.PLU'),
];

var map = rff.get(browser.getQueryVariable('map')).buffer;
render(cfg, map, artFiles, pal, PLUs);

});