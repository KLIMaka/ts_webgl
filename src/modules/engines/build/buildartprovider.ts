import { ArtProvider } from "./api";
import { Texture } from "../../drawstruct";
import { ArtInfo, ArtFiles } from "./art";
import { createTexture } from "../../textures";
import { warning } from "../../logger";

export class BuildArtProvider implements ArtProvider {
  private textures: Texture[] = [];
  private parallaxTextures: Texture[] = [];
  private infos: ArtInfo[] = [];
  private palTexture: Texture = null;
  private pluTexture: Texture = null;
  private parallaxPics = 16;

  constructor(
    private arts: ArtFiles,
    private pal: Uint8Array,
    private PLUs: Uint8Array[],
    private addTextures: { [index: number]: Texture },
    private gl: WebGLRenderingContext) { }

  private createTexture(w: number, h: number, arr: Uint8Array): Texture {
    let repeat = WebGLRenderingContext.CLAMP_TO_EDGE;
    let filter = WebGLRenderingContext.NEAREST;
    return createTexture(w, h, this.gl, { filter: filter, repeat: repeat }, arr, this.gl.LUMINANCE);
  }

  public get(picnum: number): Texture {
    const add = this.addTextures[picnum];
    if (add != undefined) return add;
    let tex = this.textures[picnum];
    if (tex != undefined) return tex;

    let info = this.arts.getInfo(picnum);
    if (info.h <= 0 || info.w <= 0) return this.get(0);
    let arr = this.axisSwap(info.img, info.h, info.w);
    tex = this.createTexture(info.w, info.h, arr);

    this.textures[picnum] = tex;
    return tex;
  }

  public getParallaxTexture(picnum: number): Texture {
    let tex = this.parallaxTextures[picnum];
    if (tex != undefined) return tex;

    let infos: ArtInfo[] = [];
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

  public getInfo(picnum: number): ArtInfo {
    let info = this.infos[picnum];
    if (info != undefined) return info;
    info = this.arts.getInfo(picnum);
    this.infos[picnum] = info;
    return info;
  }

  public getPalTexture(): Texture {
    if (this.palTexture == null)
      this.palTexture = createTexture(256, 1, this.gl, { filter: this.gl.NEAREST }, this.pal, this.gl.RGB, 3);
    return this.palTexture;
  }

  public getPluTexture(): Texture {
    if (this.pluTexture == null) {
      let tex = new Uint8Array(256 * this.getShadowSteps() * this.getPalswaps());
      for (let i = 0; i < this.getPalswaps(); i++) {
        tex.set(this.PLUs[i], 256 * this.getShadowSteps() * i);
      }
      this.pluTexture = createTexture(256, this.getShadowSteps() * this.getPalswaps(), this.gl, { filter: this.gl.NEAREST }, tex, this.gl.LUMINANCE);
    }
    return this.pluTexture;
  }

  public getPalswaps() { return this.PLUs.length }
  public getShadowSteps() { return 64 }
}