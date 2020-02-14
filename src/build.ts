import { AsyncBarrier } from './libs/asyncbarrier';
import * as browser from './libs/browser';
import * as getter from './libs/getter';
import * as IU from './libs/imgutils';
import { INJECTOR } from './libs/module';
import * as data from './libs/stream';
import { Stream } from './libs/stream';
import { Deck } from './modules/collections';
import { Texture } from './modules/drawstruct';
import { ArtProvider_, Board_, BuildContext_, BuildReferenceTracker, View_, BoardManipulator_ } from './modules/engines/build/api';
import * as ART from './modules/engines/build/art';
import { SelectorConstructor, RAW_PAL_ } from './modules/engines/build/artselector';
import { loadBloodMap, cloneBoard } from './modules/engines/build/bloodloader';
import { BloodBoard, BloodSprite } from './modules/engines/build/bloodstructs';
import { BloodImplementationConstructor } from './modules/engines/build/bloodutils';
import { createNewSector } from './modules/engines/build/boardutils';
import { ArtFiles_, BuildArtProviderConstructor, GL_, UtilityTextures_ } from './modules/engines/build/buildartprovider';
import { PicNumSelector_ } from './modules/engines/build/edit/tools/selection';
import * as RENDERER3D from './modules/engines/build/gl/boardrenderer3d';
import * as BGL from './modules/engines/build/gl/buildgl';
import { RenderablesCacheImpl, RenderablesCache_ } from './modules/engines/build/gl/cache';
import { ContextConstructor, ContextModule, KeymapConfig_ } from './modules/engines/build/gl/context';
import { ReferenceTrackerImpl } from './modules/engines/build/referencetracker';
import * as RFF from './modules/engines/build/rff';
import * as BS from './modules/engines/build/structs';
import { SwappableViewConstructor } from './modules/engines/build/view';
import * as GL from './modules/gl';
import * as INPUT from './modules/input';
import { addLogAppender, CONSOLE } from './modules/logger';
import * as TEX from './modules/textures';


function createBoard() {
  const board = new BloodBoard();
  board.walls = [];
  board.sectors = [];
  board.sprites = [];
  board.numwalls = 0;
  board.numsectors = 0;
  board.numsprites = 1;

  const points = new Deck<[number, number]>();

  const NULL_TRACKER: BuildReferenceTracker = {
    walls: new ReferenceTrackerImpl<number>(-1),
    sectors: new ReferenceTrackerImpl<number>(-1),
    sprites: new ReferenceTrackerImpl<number>(-1),
  }

  createNewSector(board, points.clear()
    .push([0, 0])
    .push([4096, 0])
    .push([4096, 4096])
    .push([0, 4096]),
    NULL_TRACKER
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

  const sprite = new BloodSprite();
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

function createUtilityTextures(gl: WebGLRenderingContext,
  gridTex: { w: number, h: number, img: Uint8Array },
  pointTex: { w: number, h: number, img: Uint8Array },
  fontTex: { w: number, h: number, img: Uint8Array }) {
  const textures: { [index: number]: Texture } = {};
  textures[-1] = TEX.createTexture(pointTex.w, pointTex.h, gl, { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE }, pointTex.img, gl.RGBA);
  textures[-2] = TEX.createTexture(fontTex.w, fontTex.h, gl, { filter: gl.NEAREST, repeat: gl.CLAMP_TO_EDGE }, fontTex.img, gl.RGBA);
  textures[-3] = TEX.createTexture(gridTex.w, gridTex.h, gl, { filter: gl.LINEAR_MIPMAP_LINEAR, repeat: gl.REPEAT, aniso: true }, gridTex.img, gl.RGBA);
  return textures;
}

function getPalTexture(gl: WebGLRenderingContext, pal: Uint8Array): Texture {
  return TEX.createTexture(256, 1, gl, { filter: gl.NEAREST }, pal, gl.RGB, 3);
}

function getPluTexture(gl: WebGLRenderingContext, PLUs: Uint8Array[], shadowsteps: number): Texture {
  const tex = new Uint8Array(256 * shadowsteps * PLUs.length);
  let i = 0;
  for (const plu of PLUs) tex.set(plu, 256 * shadowsteps * i++);
  return TEX.createTexture(256, shadowsteps * PLUs.length, gl, { filter: gl.NEAREST }, tex, gl.LUMINANCE);
}

function start(binds: string, map: ArrayBuffer, artFiles: ART.ArtFiles, pal: Uint8Array, PLUs: Uint8Array[],
  gridTex: { w: number, h: number, img: Uint8Array },
  pointTex: { w: number, h: number, img: Uint8Array },
  fontTex: { w: number, h: number, img: Uint8Array }) {

  const gl = GL.createContextFromCanvas("display", { alpha: false, antialias: false, stencil: true });
  INPUT.bind(<HTMLCanvasElement>gl.canvas);

  INJECTOR.bindInstance(GL_, gl);
  INJECTOR.bindInstance(ArtFiles_, artFiles);
  INJECTOR.bindInstance(RAW_PAL_, pal);
  INJECTOR.bindInstance(BGL.PAL_, getPalTexture(gl, pal));
  INJECTOR.bindInstance(BGL.PLUs_, getPluTexture(gl, PLUs, 64));
  INJECTOR.bindInstance(BGL.Shadowsteps_, 64);
  INJECTOR.bindInstance(BGL.Palswaps_, PLUs.length);
  INJECTOR.bindInstance(UtilityTextures_, createUtilityTextures(gl, gridTex, pointTex, fontTex));
  INJECTOR.bindInstance(RenderablesCache_, new RenderablesCacheImpl());
  INJECTOR.bindInstance(KeymapConfig_, binds);
  INJECTOR.bindInstance(BoardManipulator_, { cloneBoard });
  INJECTOR.bind(ArtProvider_, BuildArtProviderConstructor);
  INJECTOR.bind(PicNumSelector_, SelectorConstructor);
  INJECTOR.bind(View_, SwappableViewConstructor);
  INJECTOR.bind(BuildContext_, ContextConstructor);
  INJECTOR.bind(RENDERER3D.Implementation_, BloodImplementationConstructor);
  INJECTOR.bindInstance(Board_, loadBloodMap(new data.Stream(map, true)));
  INJECTOR.install(ContextModule);
  // INJECTOR.bindInstance(Board_, createBoard());

  const context = INJECTOR.getInstance(BuildContext_);

  INJECTOR.install(BGL.BuildGlModule(() => {
    GL.animate(gl, (gl: WebGLRenderingContext, time: number) => {
      context.frame(INPUT.get(), time);
      INPUT.postFrame();
    });
  }));
}

document.body.oncontextmenu = () => false;
addLogAppender(CONSOLE);

const rffFile = 'resources/engines/blood/BLOOD.RFF';
const path = 'resources/engines/blood/';
const ab = new AsyncBarrier();
const artNames = [];
for (let a = 0; a < 18; a++) {
  artNames[a] = path + 'TILES0' + ("00" + a).slice(-2) + '.ART';
  getter.preload(artNames[a], ab.callback(artNames[a]));
}

getter.preloadString('builded_binds.txt', ab.callback('binds'));
getter.preload(rffFile, ab.callback('rff'));
const gridcb = ab.callback('grid');
const pointcb = ab.callback('point');
const fontcb = ab.callback('font');
IU.loadImage("resources/grid.png", (w, h, img) => gridcb({ w, h, img }));
IU.loadImage("resources/point1.png", (w, h, img) => pointcb({ w, h, img }));
IU.loadImage("resources/img/font.png", (w, h, img) => fontcb({ w, h, img }));

ab.wait((res) => {

  const rff = RFF.create(res['rff']);
  const pal = rff.get('BLOOD.PAL');
  const arts = [];
  for (let a = 0; a < 18; a++) arts.push(ART.create(new Stream(res[artNames[a]], true)));
  const artFiles = ART.createArts(arts);

  const PLUs = [
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

  const map = rff.get(browser.getQueryVariable('map')).buffer;
  start(res['binds'], map, artFiles, pal, PLUs, res['grid'], res['point'], res['font']);
});