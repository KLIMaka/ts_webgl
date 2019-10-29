import { AsyncBarrier } from './libs/asyncbarrier';
import * as browser from './libs/browser';
import * as CFG from './libs/config';
import * as getter from './libs/getter';
import * as IU from './libs/imgutils';
import * as MU from './libs/mathutils';
import * as data from './libs/stream';
import * as GLM from './libs_js/glmatrix';
import { Controller2D } from './modules/controller2d';
import * as controller from './modules/controller3d';
import { Deck } from './modules/collections';
import * as DS from './modules/drawstruct';
import { ArtProvider } from './modules/engines/build/api';
import * as ART from './modules/engines/build/art';
import { Selector } from './modules/engines/build/artselector';
import { BloodBoard, BloodSprite } from './modules/engines/build/bloodstructs';
import { loadRorLinks, MIRROR_PIC } from './modules/engines/build/bloodutils';
import { createNewSector } from './modules/engines/build/boardutils';
import * as HANDLER from './modules/engines/build/edit/boardhandler';
import { Frame, NamedMessage } from './modules/engines/build/edit/messages';
import { DrawSector } from './modules/engines/build/edit/tools/drawsector';
import { JoinSectors } from './modules/engines/build/edit/tools/joinsectors';
import { Selection } from './modules/engines/build/edit/tools/selection';
import { SplitWall } from './modules/engines/build/edit/tools/splitwall';
import * as RENDERER2D from './modules/engines/build/gl/boardrenderer2d';
import * as RENDERER3D from './modules/engines/build/gl/boardrenderer3d';
import * as BGL from './modules/engines/build/gl/buildgl';
import { RenderablesCache } from './modules/engines/build/gl/cache';
import { Context } from './modules/engines/build/gl/context';
import { Message } from './modules/engines/build/handlerapi';
import * as RFF from './modules/engines/build/rff';
import * as BS from './modules/engines/build/structs';
import * as BU from './modules/engines/build/utils';
import * as GL from './modules/gl';
import * as INPUT from './modules/input';
import { addLogAppender, CONSOLE, warning } from './modules/logger';
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
          warning(`Invalid parallax texture #${picnum}`);
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

function createViewPoint2d(gl: WebGLRenderingContext, board: BS.Board, ctx: Context, renderables: RenderablesCache) {
  let playerstart = BU.getPlayerStart(board);
  let pointer = GLM.vec3.create();
  let control = new Controller2D();
  control.setPosition(playerstart.x, playerstart.y);
  control.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
  ctx.state.register('zoom+', false);
  ctx.state.register('zoom-', false);

  return {
    get sec() { return playerstart.sectnum },
    get x() { return playerstart.x },
    get y() { return playerstart.y },
    get z() { return playerstart.z },

    getProjectionMatrix() { return control.getProjectionMatrix() },
    getTransformMatrix() { return control.getTransformMatrix() },
    getPosition() { return pointer },
    getForward() { return [0, -1, 0] },
    unproject(x: number, y: number) { return [0, -1, 0] },
    activate() { control.setPosition(playerstart.x, playerstart.y) },

    handle(message: Message, ctx: Context) {
      if (!(message instanceof Frame)) return;
      let max = control.getPointerPosition(pointer, 1, 1);
      let campos = control.getPosition();
      let dist = MU.len2d(max[0] - campos[0], max[2] - campos[2]);
      RENDERER2D.draw(renderables.geometry, this, dist);

      let state = ctx.state;
      if (state.get('zoom+')) control.setUnitsPerPixel(control.getUnitsPerPixel() / 1.1);
      if (state.get('zoom-')) control.setUnitsPerPixel(control.getUnitsPerPixel() * 1.1);
      control.track(state.get('mouseX'), state.get('mouseY'), state.get('lookaim'));
      let x = (state.get<number>('mouseX') / ctx.gl.drawingBufferWidth) * 2 - 1;
      let y = (state.get<number>('mouseY') / ctx.gl.drawingBufferHeight) * 2 - 1;
      let p = control.getPointerPosition(pointer, x, y);

      playerstart.x = MU.int(p[0]);
      playerstart.y = MU.int(p[2]);
      if (!BU.inSector(board, playerstart.x, playerstart.y, playerstart.sectnum))
        playerstart.sectnum = BU.findSector(board, playerstart.x, playerstart.y, playerstart.sectnum);
    }
  }
}

function createViewPoint3d(gl: WebGLRenderingContext, board: BS.Board, ctx: Context, renderables: RenderablesCache) {
  let playerstart = BU.getPlayerStart(board);
  let control = new controller.Controller3D();
  control.setFov(90);
  control.setPosition(playerstart.x, playerstart.z / BU.ZSCALE + 1024, playerstart.y);
  let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
  ctx.state.register('forward', false);
  ctx.state.register('backward', false);
  ctx.state.register('strafe_left', false);
  ctx.state.register('strafe_right', false);

  return {
    get sec() { return playerstart.sectnum },
    get x() { return playerstart.x },
    get y() { return playerstart.y },
    get z() { return playerstart.z },

    getProjectionMatrix() { return control.getProjectionMatrix(aspect) },
    getTransformMatrix() { return control.getTransformMatrix() },
    getPosition() { return control.getPosition() },
    getForward() { return control.getForward() },
    unproject(x: number, y: number) { return control.getForwardUnprojected(aspect, x, y) },
    activate() { control.setPosition(playerstart.x, playerstart.z / BU.ZSCALE + 1024, playerstart.y) },

    handle(message: Message, ctx: Context) {
      if (!(message instanceof Frame)) return;
      RENDERER3D.draw(renderables.geometry, this);

      let state = ctx.state;
      let dt = ctx.state.get<number>('frametime');

      if (state.get('forward')) control.moveForward(dt * 8000);
      if (state.get('backward')) control.moveForward(-dt * 8000);
      if (state.get('strafe_left')) control.moveSideway(-dt * 8000);
      if (state.get('strafe_right')) control.moveSideway(dt * 8000);
      control.track(state.get('mouseX'), state.get('mouseY'), state.get('lookaim'));

      let p = control.getPosition();
      playerstart.x = MU.int(p[0]);
      playerstart.y = MU.int(p[2]);
      playerstart.z = MU.int(p[1] * BU.ZSCALE);
      if (!BU.inSector(board, playerstart.x, playerstart.y, playerstart.sectnum))
        playerstart.sectnum = BU.findSector(board, playerstart.x, playerstart.y, playerstart.sectnum);
    }
  }
}

function createView(gl: WebGLRenderingContext, board: BS.Board, ctx: Context, renderables: RenderablesCache) {
  ctx.state.register('lookaim', false);
  let view2d = createViewPoint2d(gl, board, ctx, renderables);
  let view3d = createViewPoint3d(gl, board, ctx, renderables);
  let view = view3d;

  return {
    get sec() { return view.sec },
    get x() { return view.x },
    get y() { return view.y },
    get z() { return view.z },
    getProjectionMatrix() { return view.getProjectionMatrix() },
    getTransformMatrix() { return view.getTransformMatrix() },
    getPosition() { return view.getPosition() },
    getForward() { return view.getForward() },
    unproject(x: number, y: number) { return view.unproject(x, y) },
    handle(message: Message, ctx: Context) {
      if (message instanceof NamedMessage && message.name == 'view_mode') {
        view = view == view3d ? view2d : view3d;
        view.activate();
      }
      view.handle(message, ctx)
    }
  }
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
function updateUi(props: UI.Properties, ms: BU.MoveStruct) {
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
}

function render(cfg: any, binds: string, map: ArrayBuffer, artFiles: ART.ArtFiles, pal: Uint8Array, PLUs: Uint8Array[], gridTex: { w: number, h: number, img: Uint8Array }) {
  let gl = GL.createContext(cfg.width, cfg.height, { alpha: false, antialias: true, stencil: true });
  let artSelector = new Selector(640, 640, artFiles, pal);

  let panel = UI.panel('Info');
  let props = UI.props();
  panel.append(props);
  document.body.appendChild(panel.elem());

  let stream = new data.Stream(map, true);
  let board = createBoard();
  // let board = loadBloodMap(stream);
  let art = new BuildArtProvider(artFiles, pal, PLUs, gl);
  let gridTexture = TEX.createTexture(gridTex.w, gridTex.h, gl, { filter: gl.NEAREST_MIPMAP_NEAREST, repeat: gl.REPEAT, aniso: true }, gridTex.img, gl.RGBA);
  INPUT.bind(<HTMLCanvasElement>gl.canvas);

  let rorLinks = loadRorLinks(board);
  let impl: RENDERER3D.Implementation = {
    isMirrorPic(picnum: number) { return picnum == MIRROR_PIC },
    rorLinks() { return rorLinks }
  }

  let context = new Context(art, board, gl);
  context.loadBinds(binds);
  let cache = new RenderablesCache(context);
  context.setBoardInvalidator(cache);
  let view = createView(gl, board, context, cache);

  BGL.init(gl, art.getPalTexture(), art.getPluTexture(), art.getPalswaps(), art.getShadowSteps(), gridTexture, () => {
    HANDLER.init(context);
    HANDLER.addHandler(new Selection(context, (cb) => artSelector.modal(cb), cache.helpers));
    HANDLER.addHandler(new SplitWall());
    HANDLER.addHandler(new JoinSectors());
    HANDLER.addHandler(new DrawSector());
    HANDLER.addHandler(context);
    HANDLER.addHandler(view);

    RENDERER3D.init(context, impl);
    RENDERER2D.init(context);
    GL.animate(gl, (gl: WebGLRenderingContext, time: number) => {
      BGL.newFrame(gl);

      PROFILE.start();
      HANDLER.handle(INPUT.get(), view, time);
      PROFILE.endProfile()

      updateUi(props, view);

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
getter.preloadString('builded_binds.txt', ab.callback('binds'));
getter.preload(rffFile, ab.callback('rff'), progress(rffFile));
let gridcb = ab.callback('grid');
IU.loadImage("resources/grid.png", (w, h, img) => gridcb({ w, h, img }));

ab.wait((res) => {

  let cfg = CFG.create(res['cfg']);
  addLogAppender(CONSOLE);
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
  render(cfg, res['binds'], map, artFiles, pal, PLUs, res['grid']);
});