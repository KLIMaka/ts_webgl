import { AsyncBarrier } from './libs/asyncbarrier';
import * as browser from './libs/browser';
import * as getter from './libs/getter';
import * as IU from './libs/imgutils';
import * as data from './libs/stream';
import { Deck } from './modules/collections';
import * as ART from './modules/engines/build/art';
import { Selector } from './modules/engines/build/artselector';
import { cloneBoard, loadBloodMap } from './modules/engines/build/bloodloader';
import { BloodBoard, BloodSprite } from './modules/engines/build/bloodstructs';
import { loadRorLinks, MIRROR_PIC } from './modules/engines/build/bloodutils';
import { createInnerLoop, createNewSector } from './modules/engines/build/boardutils';
import { BuildArtProvider } from './modules/engines/build/buildartprovider';
import { DrawSector } from './modules/engines/build/edit/tools/drawsector';
import { JoinSectors } from './modules/engines/build/edit/tools/joinsectors';
import { PushWall } from './modules/engines/build/edit/tools/pushwall';
import { Selection } from './modules/engines/build/edit/tools/selection';
import { SplitWall } from './modules/engines/build/edit/tools/splitwall';
import * as RENDERER3D from './modules/engines/build/gl/boardrenderer3d';
import * as BGL from './modules/engines/build/gl/buildgl';
import { RenderablesCache } from './modules/engines/build/gl/cache';
import { Context } from './modules/engines/build/gl/context';
import { Info } from './modules/engines/build/info';
import * as RFF from './modules/engines/build/rff';
import { Statusbar as StatusBar } from './modules/engines/build/statusbar';
import * as BS from './modules/engines/build/structs';
import { createView } from './modules/engines/build/view';
import * as GL from './modules/gl';
import * as INPUT from './modules/input';
import { addLogAppender, CONSOLE } from './modules/logger';
import * as TEX from './modules/textures';


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
  createInnerLoop(board, 0, points.clear()
    .push([1024, 1024])
    .push([1024, 3072])
    .push([3072, 3072])
    .push([3072, 1024])
  );
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
  sprite.extra = 65535;
  board.sprites.push(sprite);
  return board;
}

function start(binds: string, map: ArrayBuffer, artFiles: ART.ArtFiles, pal: Uint8Array, PLUs: Uint8Array[], gridTex: { w: number, h: number, img: Uint8Array }) {
  let gl = GL.createContextFromCanvas("display", { alpha: false, antialias: false, stencil: true });
  let artSelector = new Selector(artFiles, pal);
  let stream = new data.Stream(map, true);
  // let board = createBoard();
  let board = loadBloodMap(stream);
  let art = new BuildArtProvider(artFiles, pal, PLUs, gl);
  let gridTexture = TEX.createTexture(gridTex.w, gridTex.h, gl, { filter: gl.NEAREST_MIPMAP_NEAREST, repeat: gl.REPEAT, aniso: true }, gridTex.img, gl.RGBA);
  INPUT.bind(<HTMLCanvasElement>gl.canvas);

  let rorLinks = loadRorLinks(board);
  let impl: RENDERER3D.Implementation = {
    isMirrorPic(picnum: number) { return picnum == MIRROR_PIC },
    rorLinks() { return rorLinks }
  }

  let context = new Context(art, board, { cloneBoard }, gl);
  context.loadBinds(binds);
  let cache = new RenderablesCache(context);
  context.setBoardInvalidator(cache);
  let view = createView(gl, board, context, cache, impl);

  BGL.init(gl, art.getPalTexture(), art.getPluTexture(), art.getPalswaps(), art.getShadowSteps(), gridTexture, () => {
    context.addHandler(new Selection(context, (cb) => artSelector.modal(cb), cache.helpers));
    context.addHandler(new SplitWall());
    context.addHandler(new JoinSectors());
    context.addHandler(new DrawSector());
    context.addHandler(new PushWall());
    context.addHandler(new Info());
    context.addHandler(new StatusBar());
    context.addHandler(view);

    GL.animate(gl, (gl: WebGLRenderingContext, time: number) => {
      BGL.newFrame(context);
      context.frame(INPUT.get(), view, time);
      INPUT.postFrame();
    });
  });
}

document.body.oncontextmenu = () => false;
addLogAppender(CONSOLE);

let rffFile = 'resources/engines/blood/BLOOD.RFF';
let path = 'resources/engines/blood/';
let ab = new AsyncBarrier();
let artNames = [];
for (let a = 0; a < 18; a++) {
  artNames[a] = path + 'TILES0' + ("00" + a).slice(-2) + '.ART';
  getter.preload(artNames[a], ab.callback(artNames[a]));
}

getter.preloadString('builded_binds.txt', ab.callback('binds'));
getter.preload(rffFile, ab.callback('rff'));
let gridcb = ab.callback('grid');
IU.loadImage("resources/grid.png", (w, h, img) => gridcb({ w, h, img }));

ab.wait((res) => {

  let rff = RFF.create(res['rff']);
  let pal = rff.get('BLOOD.PAL');
  let arts = [];
  for (let a = 0; a < 18; a++) arts.push(ART.create(new data.Stream(res[artNames[a]], true)));
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
  start(res['binds'], map, artFiles, pal, PLUs, res['grid']);
});