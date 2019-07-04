import * as MB from './meshbuilder';
import * as BAG from '../libs/bag';
import * as PROFILE from '../modules/profiler';

export class Pointer {
  constructor(
    public buffer: Buffer,
    public vtx: BAG.Place,
    public idx: BAG.Place
  ) { }
}

export class BufferBuilder {
  public vtxBuffers: { [index: string]: MB.VertexBufferDynamic } = {};

  constructor(public size: number) { }

  public addVertexBuffer(gl: WebGLRenderingContext, name: string, type: number, spacing: number): BufferBuilder {
    this.vtxBuffers[name] = MB.createVertexBuffer(gl, type, this.size, spacing);
    return this;
  }
}

export class Buffer {
  private size: number;
  private vtxBag: BAG.BagController;
  private idxBag: BAG.BagController;
  private vtxBuffers: { [index: string]: MB.VertexBufferDynamic };
  private idxBuffer: MB.DynamicIndexBuffer;
  private vtxRegions: { [index: string]: number[][] } = {};
  private idxRegions: number[][] = [];

  constructor(gl: WebGLRenderingContext, builder: BufferBuilder) {
    this.size = builder.size;
    this.vtxBuffers = builder.vtxBuffers;
    this.idxBuffer = MB.createIndexBuffer(gl, gl.UNSIGNED_SHORT, this.size);

    this.vtxBag = BAG.createController(this.size, (place: BAG.Place, noffset: number) => {
      for (let v in this.vtxBuffers) {
        let buff = <any>this.vtxBuffers[v].getData();
        let spacing = this.vtxBuffers[v].getSpacing();
        buff.set(buff.subarray(place.offset * spacing, (place.offset + place.size) * spacing), noffset * spacing);
      }
      let ptr = <BAG.Place>place.data;
      let offdiff = noffset - place.offset;
      let idxData = <Uint16Array>this.idxBuffer.getData();
      for (let i = 0; i < ptr.size; i++) {
        idxData[ptr.offset + i] += offdiff;
      }
    });

    this.idxBag = BAG.createController(this.size, (place: BAG.Place, noffset: number) => {
      let idxData = <Uint16Array>this.idxBuffer.getData();
      idxData.set(idxData.subarray(place.offset, place.offset + place.size), noffset);
    });

    for (let v in this.vtxBuffers)
      this.vtxRegions[v] = [];
  }

  public getVertexBuffer(name: string): MB.VertexBufferDynamic {
    return this.vtxBuffers[name];
  }

  public getIndexBuffer(): MB.DynamicIndexBuffer {
    return this.idxBuffer;
  }

  public allocate(vtxs: number, idxs: number): Pointer {
    let vtx = this.vtxBag.get(vtxs);
    let idx = this.idxBag.get(idxs);
    vtx.data = idx;
    return new Pointer(this, vtx, idx);
  }

  public deallocate(ptr: Pointer): void {
    if (ptr.buffer != this)
      throw new Error('Invalid Buffer for this Pointer');
    this.vtxBag.put(ptr.vtx);
    this.idxBag.put(ptr.idx);
  }

  public writeVertex(ptr: Pointer, name: string, off: number, vdata: number[]) {
    let buff = this.vtxBuffers[name];
    let offset = (ptr.vtx.offset + off) * buff.getSpacing();
    let data = <any>buff.getData();
    for (let i = 0; i < vdata.length; i++) {
      data[offset + i] = vdata[i];
    }
    this.vtxRegions[name].push([offset / buff.getSpacing(), Math.ceil(vdata.length / buff.getSpacing())]);
  }

  public writeIndex(ptr: Pointer, off: number, idata: number[]) {
    let buff = this.idxBuffer;
    let offset = ptr.idx.offset + off;
    let vtxoff = ptr.vtx.offset;
    let data = <any>buff.getData();
    for (let i = 0; i < idata.length; i++) {
      data[offset + i] = idata[i] + vtxoff;
    }
    this.idxRegions.push([offset, idata.length]);
  }

  private mergeRegions(regions: number[][], i: number): [number, number[]] {
    let region = regions[i];
    while (i + 1 < regions.length && regions[i + 1][0] == region[0] + region[1]) {
      region[1] += regions[++i][1];
    }
    return [i, region];
  }

  private updateBuffer(gl: WebGLRenderingContext, buffer: any, regions: number[][]): boolean {
    for (let i = 0; i < regions.length; i++) {
      let [ii, region] = this.mergeRegions(regions, i);
      i = ii;
      PROFILE.get(null).inc('traffic', region[1]);
      buffer.updateRegion(gl, region[0], region[1]);
    }
    return true;
  }

  public update(gl: WebGLRenderingContext) {
    for (let v in this.vtxRegions) {
      if (this.vtxRegions[v].length == 0)
        continue;
      this.updateBuffer(gl, this.vtxBuffers[v], this.vtxRegions[v]);
      this.vtxRegions[v] = [];
    }
    if (this.idxRegions.length != 0) {
      this.updateBuffer(gl, this.idxBuffer, this.idxRegions);
      this.idxRegions = [];
    }
  }

  public getVertexFreeSpace() {
    return this.vtxBag.freeSpace() / this.size;
  }
}