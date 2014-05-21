/// <reference path="../defs/webgl.d.ts" />

export interface VertexBuffer {

  getBuffer(): WebGLBuffer;
  getType(): number;
  getSpacing(): number;
  getNormalized(): boolean;
  getStride(): number;
  getOffset(): number;
}

export interface IndexBuffer {

  getBuffer(): WebGLBuffer;
  getType(): number;
}

export interface DrawStruct {

  getMode(): number;
  getVertexBuffer(attribute:string): VertexBuffer;
  getAttributes(): string[];
  getIndexBuffer(): IndexBuffer;
  getLength(): number;
  getOffset(): number;
}

export class Mesh implements DrawStruct {

  private idx:IndexBuffer;
  private mode:number;
  private length:number;
  private vtxBuffers:{[index: string]:VertexBuffer};

  constructor(vtxBuffers:{[index: string]:VertexBuffer}, idx:IndexBuffer, mode:number, length:number) {
    this.vtxBuffers = vtxBuffers;
    this.idx = idx;
    this.mode = mode;
    this.length = length;
  }

  getMode():number {
    return this.mode;
  }

  getVertexBuffer(attribute:string):VertexBuffer {
    return this.vtxBuffers[attribute];
  }

  getAttributes():string[] {
    return Object.keys(this.vtxBuffers);
  }

  getIndexBuffer():IndexBuffer {
    return this.idx;
  }

  getLength():number {
    return this.length;
  }

  getOffset():number {
    return 0;
  }
}