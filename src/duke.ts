import * as data from './libs/stream';
import * as getter from './libs/getter';
import * as IU from './libs/imgutils';
import * as MU from './libs/mathutils';
import * as controller from './modules/controller3d';
import * as DS from './modules/drawstruct';
import * as ART from './modules/engines/build/art';
import * as RENDERER from './modules/engines/build/gl/boardrenderer';
import * as GRP from './modules/engines/build/grp';
import * as BUILDLOADER from './modules/engines/build/loader';
import * as BS from './modules/engines/build/structs';
import * as BU from './modules/engines/build/utils';
import * as GL from './modules/gl';
import * as INPUT from './modules/input';
import * as PROFILE from './modules/profiler';
import * as TEX from './modules/textures';
import * as UI from './modules/ui/ui';

class BuildArtProvider implements RENDERER.PalProvider {
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
      let tex = new Uint8Array(256 * this.getShadowSteps() * this.PLUs.length);
      for (let i = 0; i < this.PLUs.length; i++) {
        tex.set(this.PLUs[i], 256 * this.getShadowSteps() * i);
      }
      this.pluTexture = TEX.createTexture(256, this.getShadowSteps() * this.PLUs.length, this.gl, { filter: this.gl.NEAREST }, tex, this.gl.LUMINANCE);
    }
    return this.pluTexture;
  }

  public getPalswaps() { return 1; }
  public getShadowSteps() { return 32; }
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

function render(map: ArrayBuffer, artFiles: ART.ArtFiles, pal: Uint8Array, PLUs: Uint8Array[]) {
  let gl = GL.createContext(1200, 800, { alpha: false, antialias: true, stencil: true });

  let info = {}
  let props = UI.props([
    'X:',
    'Y:',
    'Sector:',
    'Processing:',
    'Hitscan:',
    'Rendering:',
    'Frame Time:',
    'Buffer Traffic:',
    'Buffer Updates:',
    'Buffer Usage:',
    'PVS:',
    'RORs:',
    'Mirrors:',
    'Sectors:',
    'Walls:',
    'Sprites:'
  ]);

  let panel = UI.panel('Info');
  panel.append(props);
  let compass = IU.createEmptyCanvas(50, 50);
  panel.append(new UI.Element(compass));
  document.body.appendChild(panel.elem());

  let stream = new data.Stream(map, true);
  let board = BUILDLOADER.loadBuildMap(stream);
  console.log(board);
  let art = new BuildArtProvider(artFiles, pal, PLUs, gl);
  let control = new controller.Controller3D();
  INPUT.bind();
  control.setFov(75);
  let ms = createMoveStruct(board, control);

  let rorLins = new RENDERER.RorLinks();
  let impl: RENDERER.Implementation = {
    isMirrorPic(picnum: number) { return false },
    rorLinks() { return rorLins }
  }

  RENDERER.init(gl, art, impl, board, () => {

    GL.animate(gl, (gl: WebGLRenderingContext, time: number) => {

      let pos = control.getCamera().getPosition();
      ms.x = MU.int(pos[0]); ms.y = MU.int(pos[2]), ms.z = MU.int((pos[1]) * -16);
      control.getCamera().setPosition([ms.x, ms.z / -16, ms.y]);

      PROFILE.start();
      RENDERER.draw(gl, board, ms, control);
      PROFILE.endProfile()

      info['Rendering:'] = PROFILE.get('draw').time.toFixed(2) + 'ms';
      info['Processing:'] = PROFILE.get('processing').time.toFixed(2) + 'ms';
      info['Frame Time:'] = (1000 / PROFILE.get(null).time).toFixed(0) + 'fps';
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
      info['Sector:'] = ms.sec;
      info['X:'] = ms.x;
      info['Y:'] = ms.y;
      props.refresh(info);

      control.think(time);
      INPUT.postFrame();
    });

    gl.canvas.oncontextmenu = () => false;
  });

}

function loadPLUs(grp: GRP.GrpFile): Uint8Array[] {
  let paldat = grp.get('PALETTE.DAT');
  paldat.skip(768);
  let shadowsteps = paldat.readUShort();
  let plu = data.atomic_array(data.ubyte, shadowsteps * 256).read(paldat);
  return [plu];
}

let grpFile = "resources/engines/duke/DUKE3D.GRP";
let mapFile = "resources/buildmaps/DUKEDC4.MAP";
getter.loader
  .load(grpFile, progress(grpFile))
  .load(mapFile, progress(mapFile))
  .finish(() => {

    let grp = GRP.create(getter.get(grpFile));
    let pal = GRP.createPalette(grp.get('PALETTE.DAT'));
    let map = getter.get(mapFile);
    let arts = [];
    for (let a = 0; a < 20; a++) arts.push(ART.create(grp.get('TILES0' + ("00" + a).slice(-2) + '.ART')));
    let artFiles = ART.createArts(arts);
    let PLUs = loadPLUs(grp);

    render(map, artFiles, pal, PLUs);
  });