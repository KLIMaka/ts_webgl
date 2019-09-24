import { AsyncBarrier } from './libs/asyncbarrier';
import * as browser from './libs/browser';
import * as CFG from './libs/config';
import * as getter from './libs/getter';
import * as IU from './libs/imgutils';
import * as MU from './libs/mathutils';
import * as data from './libs/stream';
import * as controller from './modules/controller3d';
import { Deck } from './modules/deck';
import * as DS from './modules/drawstruct';
import * as ART from './modules/engines/build/art';
import { Selector } from './modules/engines/build/artselector';
import { loadBloodMap } from './modules/engines/build/bloodloader';
import { BloodBoard, BloodSprite } from './modules/engines/build/bloodstructs';
import { loadRorLinks, MIRROR_PIC } from './modules/engines/build/bloodutils';
import { createNewSector } from './modules/engines/build/boardutils';
import * as HANDLER from './modules/engines/build/edit/boardhandler';
import { ArtProvider } from './modules/engines/build/api';
import * as RENDERER from './modules/engines/build/gl/boardrenderer';
import * as BGL from './modules/engines/build/gl/buildgl';
import { RenderablesCache } from './modules/engines/build/gl/cache';
import { Context } from './modules/engines/build/gl/context';
import * as RFF from './modules/engines/build/rff';
import * as BS from './modules/engines/build/structs';
import * as BU from './modules/engines/build/utils';
import * as GL from './modules/gl';
import * as INPUT from './modules/input';
import * as PROFILE from './modules/profiler';
import * as TEX from './modules/textures';
import * as UI from './modules/ui/ui';

let rffFile = 'resources/engines/blood/BLOOD.RFF';
let cfgFile = 'build.cfg';

class BuildArtProvider implements ArtProvider {
  private textures: DS.Texture[] = [];
  private parallaxTextures: DS.Texture[] = [];
  private infos: ART.ArtInfo[] = [];
  private palTexture: DS.Texture = null;
  private pluTexture: DS.Texture = null;
  private parallaxPics = 16;

  constructor(
    private arts: ART.ArtFiles,
    private pal: Uint8Array,
    private PLUs: Uint8Array[],
    private gl: WebGLRenderingContext) { }

  private createTexture(w: number, h: number, arr: Uint8Array): DS.Texture {
    let repeat = WebGLRenderingContext.CLAMP_TO_EDGE;
    let filter = WebGLRenderingContext.NEAREST;
    return TEX.createTexture(w, h, this.gl, { filter: filter, repeat: repeat }, arr, this.gl.LUMINANCE);
  }

  public get(picnum: number): DS.Texture {
    let tex = this.textures[picnum];
    if (tex != undefined)
      return tex;

    let info = this.arts.getInfo(picnum);
    if (info.h <= 0 || info.w <= 0)
      return this.get(0);
    let arr = this.axisSwap(info.img, info.h, info.w);
    tex = this.createTexture(info.w, info.h, arr);

    this.textures[picnum] = tex;
    return tex;
  }

  public getParallaxTexture(picnum: number): DS.Texture {
    let tex = this.parallaxTextures[picnum];
    if (tex != undefined)
      return tex;

    let infos: ART.ArtInfo[] = [];
    let axisSwapped: Uint8Array[] = [];
    for (let i = 0; i < this.parallaxPics; i++) {
      infos[i] = this.arts.getInfo(picnum + i);
      if (i != 0) {
        if (infos[i].w != infos[i - 1].w || infos[i].h != infos[i - 1].h) {
          console.warn('Invalid parallax texture #' + picnum);
          return this.get(0);
        }
      }
      axisSwapped[i] = this.axisSwap(infos[i].img, infos[i].h, infos[i].w);
    }
    let w = infos[0].w;
    let h = infos[0].h;
    let merged = this.mergeParallax(w, h, axisSwapped);
    tex = this.createTexture(w * this.parallaxPics, h, merged);

    this.parallaxTextures[picnum] = tex;
    return tex;
  }

  private mergeParallax(w: number, h: number, arrs: Uint8Array[]): Uint8Array {
    let result = new Uint8Array(w * h * this.parallaxPics);
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < this.parallaxPics; i++) {
        for (let x = 0; x < w; x++) {
          result[y * w * this.parallaxPics + i * w + x] = arrs[i][y * w + x];
        }
      }
    }
    return result;
  }

  private axisSwap(data: Uint8Array, w: number, h: number): Uint8Array {
    let result = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        result[x * h + y] = data[y * w + x];
      }
    }
    return result;
  }

  public getInfo(picnum: number): ART.ArtInfo {
    let info = this.infos[picnum];
    if (info == undefined) {
      info = this.arts.getInfo(picnum);
      this.infos[picnum] = info;
    }
    return info;
  }

  public getPalTexture(): DS.Texture {
    if (this.palTexture == null)
      this.palTexture = TEX.createTexture(256, 1, this.gl, { filter: this.gl.NEAREST }, this.pal, this.gl.RGB, 3);
    return this.palTexture;
  }

  public getPluTexture(): DS.Texture {
    if (this.pluTexture == null) {
      let tex = new Uint8Array(256 * this.getShadowSteps() * this.getPalswaps());
      for (let i = 0; i < this.getPalswaps(); i++) {
        tex.set(this.PLUs[i], 256 * this.getShadowSteps() * i);
      }
      this.pluTexture = TEX.createTexture(256, this.getShadowSteps() * this.getPalswaps(), this.gl, { filter: this.gl.NEAREST }, tex, this.gl.LUMINANCE);
    }
    return this.pluTexture;
  }

  public getPalswaps() { return this.PLUs.length }
  public getShadowSteps() { return 64 }
}

function drawCompass(canvas: HTMLCanvasElement, eye: number[]) {
  let ctx = canvas.getContext('2d');
  let w = canvas.width;
  let h = canvas.height;
  let r = Math.min(w, h) / 2 - 1;
  let x = r + eye[0] * r;
  let y = r + eye[2] * r;
  let z = r - eye[1] * r;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'black';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(w, z, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'black';
  ctx.fill();
}

let loadPanel = UI.verticalPanel('loadPanel');
document.body.appendChild(loadPanel.elem());
let loaders = {};
let index = [];
function progress(fname: string) {
  return (p: number) => {
    let loader = loaders[fname];
    if (loader == undefined) {
      loader = UI.progress(fname);
      loadPanel.add(loader);
      loaders[fname] = loader;
    }
    loader.setValue(p * 100);
    if (p == 1)
      loader.css('display', 'none');
  }
}

function createMoveStruct(board: BS.Board, control: controller.Controller3D) {
  let playerstart = BU.getPlayerStart(board);
  let ms = new BU.MoveStruct();
  ms.sec = playerstart.sectnum;
  ms.x = playerstart.x;
  ms.y = playerstart.y;
  ms.z = playerstart.z;
  control.getCamera().setPositionXYZ(ms.x, ms.z / -16 + 1024, ms.y);
  return ms;
}


function createBoard() {
  let board = new BloodBoard();
  board.walls = [];
  board.sectors = [];
  board.sprites = [];
  board.numwalls = 0;
  board.numsectors = 0;
  board.numsprites = 1;

  let points = new Deck<[number, number]>();

  createNewSector(board, points.clear()
    .push([0, 0])
    .push([4096, 0])
    .push([4096, 4096])
    .push([0, 4096])
  );
  // createInnerLoop(board, 0, points.clear()
  //   .push([1024, 1024])
  //   .push([1024, 3072])
  //   .push([3072, 3072])
  //   .push([3072, 1024])
  // );
  // createNewSector(board, points.clear()
  //   .push([1024, 1024])
  //   .push([1024, 3072])
  //   .push([3072, 3072])
  //   .push([3072, 1024])
  // );

  board.sectors[0].floorz = 0;
  board.sectors[0].ceilingz = -16 * 4096;
  // board.sectors[1].floorz = -16 * 1024;
  // board.sectors[1].ceilingz = -16 * 3072;

  let sprite = new BloodSprite();
  sprite.x = 1024;
  sprite.y = 1024;
  sprite.z = 0;
  sprite.picnum = 0;
  sprite.lotag = 1;
  sprite.sectnum = 0;
  sprite.cstat = new BS.SpriteStats();
  board.sprites.push(sprite);
  return board;
}

let info = {}
let compass = IU.createEmptyCanvas(50, 50);
function updateUi(props: UI.Properties, ms: BU.MoveStruct, ctr: controller.Controller3D) {
  info['Frame Time:'] = (1000 / PROFILE.get(null).time).toFixed(0) + 'fps';
  info['Rendering:'] = PROFILE.get('draw').time.toFixed(2) + 'ms';
  info['Processing:'] = PROFILE.get('processing').time.toFixed(2) + 'ms';
  info['Hitscan:'] = PROFILE.get('hitscan').time.toFixed(2) + 'ms';
  info['Sectors:'] = PROFILE.get('processing').counts['sectors'];
  info['Walls:'] = PROFILE.get('processing').counts['walls'];
  info['Sprites:'] = PROFILE.get('processing').counts['sprites'];
  info['PVS:'] = PROFILE.get(null).counts['pvs'] || 0;
  info['RORs:'] = PROFILE.get(null).counts['rors'];
  info['Mirrors:'] = PROFILE.get(null).counts['mirrors'];
  info['Buffer Traffic:'] = ((PROFILE.get(null).counts['traffic'] || 0) / 1024).toFixed(2) + 'k';
  info['Buffer Updates:'] = PROFILE.get(null).counts['updates'] || 0;
  info['Buffer Usage:'] = (100 * PROFILE.get(null).counts['buffer']).toFixed(2) + '%';
  info['Draw Calls:'] = PROFILE.get(null).counts['draws'];
  info['Sector:'] = ms.sec;
  info['X:'] = ms.x;
  info['Y:'] = ms.y;

  props.refresh(info);
  drawCompass(compass, ctr.getCamera().forward());
}

function render(cfg: any, map: ArrayBuffer, artFiles: ART.ArtFiles, pal: Uint8Array, PLUs: Uint8Array[], gridTex: { w: number, h: number, img: Uint8Array }) {
  let gl = GL.createContext(cfg.width, cfg.height, { alpha: false, antialias: true, stencil: true });
  let artSelector = new Selector(640, 640, artFiles, pal);

  let panel = UI.panel('Info');
  let props = UI.props();
  panel.append(props);
  panel.append(new UI.Element(compass));
  document.body.appendChild(panel.elem());

  let stream = new data.Stream(map, true);
  let board = createBoard();
  // let board = loadBloodMap(stream);
  let art = new BuildArtProvider(artFiles, pal, PLUs, gl);
  let gridTexture = TEX.createTexture(gridTex.w, gridTex.h, gl, { filter: gl.NEAREST_MIPMAP_NEAREST, repeat: gl.REPEAT, aniso: true }, gridTex.img, gl.RGBA);
  let control = new controller.Controller3D();
  control.setFov(90);
  INPUT.bind(<HTMLCanvasElement>gl.canvas);
  let ms = createMoveStruct(board, control);

  let rorLinks = loadRorLinks(board);
  let impl: RENDERER.Implementation = {
    isMirrorPic(picnum: number) { return picnum == MIRROR_PIC },
    rorLinks() { return rorLinks }
  }

  let context = new Context(art, board, gl);
  let cache = new RenderablesCache(context);
  context.setBoardInvalidator(cache);

  BGL.init(gl, art.getPalTexture(), art.getPluTexture(), art.getPalswaps(), art.getShadowSteps(), gridTexture, () => {
    HANDLER.init(context, (cb) => artSelector.modal(cb));
    RENDERER.init(context, impl);
    GL.animate(gl, (gl: WebGLRenderingContext, time: number) => {
      BGL.newFrame(gl);

      let pos = control.getCamera().getPosition();
      ms.x = MU.int(pos[0]); ms.y = MU.int(pos[2]), ms.z = MU.int((pos[1]) * BU.ZSCALE);
      if (!BU.inSector(board, ms.x, ms.y, ms.sec)) ms.sec = BU.findSector(board, ms.x, ms.y, ms.sec);
      control.getCamera().setPosition([ms.x, ms.z / -16, ms.y]);

      PROFILE.start();
      RENDERER.draw(cache.geometry, ms, control);
      HANDLER.handle(cache.helpers, ms, control, time);
      PROFILE.endProfile()

      updateUi(props, ms, control);

      INPUT.postFrame();
    });
    (<HTMLCanvasElement>gl.canvas).oncontextmenu = () => false;
  });
}

let path = 'resources/engines/blood/';
let ab = new AsyncBarrier();
let artNames = [];
for (let a = 0; a < 18; a++) {
  artNames[a] = path + 'TILES0' + ("00" + a).slice(-2) + '.ART';
  getter.preload(artNames[a], ab.callback(artNames[a]), progress(artNames[a]));
}

getter.preloadString(cfgFile, ab.callback('cfg'));
getter.preload(rffFile, ab.callback('rff'), progress(rffFile));
let gridcb = ab.callback('grid');
IU.loadImage("resources/grid.png", (w, h, img) => gridcb({ w, h, img }));

ab.wait((res) => {

  let cfg = CFG.create(res['cfg']);
  let rff = RFF.create(res['rff']);
  let pal = rff.get('BLOOD.PAL');
  let arts = [];
  for (let a = 0; a < 18; a++)
    arts.push(ART.create(new data.Stream(res[artNames[a]], true)));
  let artFiles = ART.createArts(arts);

  let PLUs = [
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

  let map = rff.get(browser.getQueryVariable('map')).buffer;
  render(cfg, map, artFiles, pal, PLUs, res['grid']);
});