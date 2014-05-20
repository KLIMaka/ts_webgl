/// <reference path="../defs/webgl.d.ts" />

import GLM = require('../libs_js/glmatrix');
import MU  = require('../libs/mathutils');

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

export interface DrawData {

  getMode(): number;
  getVertexBuffer(attribute:string): VertexBuffer;
  getAttributes(): string[];
  getIndexBuffer(): IndexBuffer;
  getLength(): number;
  getOffset(): number;
}

class VertexBufferBuilder {

  private buffer:number[] = [];

  constructor(
    private arrayType:any,
    private type:number, 
    private spacing:number, 
    private normalized:boolean,
    private stride:number,
    private offset:number
  ) {}

  public push(data:number[]):void {
    for (var i = 0; i < data.length; i++)
      this.buffer.push(data[i]);
  }

  public build(gl:WebGLRenderingContext):VertexBuffer {
    var bufIdx = gl.createBuffer();
    var data = new this.arrayType(this.buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufIdx);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return new VertexBufferImpl(bufIdx, this.type, this.spacing, this.normalized, this.stride, this.offset);
  }
}

class VertexBufferImpl implements VertexBuffer {

  constructor(
    private buffer:WebGLBuffer, 
    private type:number, 
    private spacing:number = 3, 
    private normalized:boolean = false, 
    private stride:number = 0, 
    private offset:number = 0
  ) {}

  getBuffer():WebGLBuffer {
    return this.buffer;
  }

  getType():number {
    return this.type;
  }

  getSpacing():number {
    return this.spacing;
  }

  getNormalized():boolean {
    return this.normalized;
  }

  getStride():number {
    return this.stride;
  }

  getOffset():number {
    return this.offset;
  }
}

class VertexBufferImplLine extends  VertexBufferImpl {

  constructor(buffer:WebGLBuffer, type:number) {
    super(buffer, type, 2);
  }
}

export var NONE = 0;
export var TRIANGLES = 3;
export var QUADS = 4;

export class IndexBufferBuilder {

  private buffer:number[] = [];
  private idx = 0;
  private mode = NONE;
  private vtxCounter = 0;

  constructor(
    private arrayType:any,
    private type:number
  ) {}

  public setMode(mode:number):void {
    if (this.vtxCounter != 0)
      throw new Error('Incomplete primitive!');
    this.mode = mode;
    this.vtxCounter = 0;
  }

  public vtx():void {
    this.vtxCounter++;
    if (this.mode == TRIANGLES && this.vtxCounter % TRIANGLES == 0) {
      this.pushTriangle();
      this.vtxCounter = 0;
    }
    if (this.mode == QUADS && this.vtxCounter % QUADS == 0) {
      this.pushQuad();
      this.vtxCounter = 0;
    }
  }

  private pushTriangle():void {
    var idx = this.idx;
    this.buffer.push(idx, idx + 2, idx + 1)
    this.idx += 3;
  }

  private pushQuad():void {
    var idx = this.idx;
    this.buffer.push(idx, idx + 2, idx + 1, idx, idx + 3, idx + 2);
    this.idx += 4;
  }

  public length():number {
    return this.buffer.length;
  }

  public build(gl:WebGLRenderingContext):IndexBuffer {
    var bufIdx = gl.createBuffer();
    var data = new this.arrayType(this.buffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return new IndexBufferImpl(bufIdx, this.type);
  }
}

class IndexBufferImpl implements IndexBuffer {

  private buffer:WebGLBuffer;
  private type:number;

  getBuffer():WebGLBuffer {
    return this.buffer;
  }

  getType():number {
    return this.type;
  }

  constructor(buffer:WebGLBuffer, type:number) {
    this.buffer = buffer;
    this.type = type;
  }
}

export class Mesh implements DrawData {

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

export class WireBuilder {

  private points:number[] = [];
  private indices:number[] = [];
  private lasIndex:number = 0;

  private addVertex(vtx:number[]):void {
    this.points.push(vtx[0], vtx[1]);
  }

  addLine(start:number[], end:number[]) {
    this.addVertex(start);
    this.addVertex(end);
    var idx = this.lasIndex;
    this.indices.push(idx, idx + 1);
    this.lasIndex += 2;
  }

  build(gl:WebGLRenderingContext) {
    var posBuffer = gl.createBuffer();
    var posData = new Float32Array(this.points);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, posData, gl.STATIC_DRAW);
    var pos = new VertexBufferImplLine(posBuffer, gl.FLOAT);

    var idxBuffer = gl.createBuffer();
    var idxData = new Uint16Array(this.indices);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxData, gl.STATIC_DRAW);
    var idx = new IndexBufferImpl(idxBuffer, gl.UNSIGNED_SHORT);

    return new Mesh(pos, idx, gl.LINES, idxData.length);
  }
}

export class MeshBuilder {

  private attrs = {};

  constructor(
    private buffers:any, 
    private idx:IndexBufferBuilder
  ) {}

  public start(mode:number):MeshBuilder {
    this.idx.setMode(mode);
    return this;
  }

  public attr(attr:string, data:number[]):MeshBuilder {
    this.attrs[attr] = data;
    return this;
  }

  public vtx(vtxAttr:string, data:number[]):MeshBuilder {
    this.attrs[vtxAttr] = data;
    for (var attr in this.attrs) {
      this.buffers[attr].push(this.attrs[attr]);
    }
    this.idx.vtx();
    return this;
  }

  public end():void {
    this.idx.setMode(NONE);
    this.attrs = {};
  }

  public build(gl:WebGLRenderingContext):DrawData {
    var bufs = {};
    for (var bufName in this.buffers) {
      bufs[bufName] = this.buffers[bufName].build(gl);
    }
    var idx = this.idx.build(gl);
    return new Mesh(bufs, idx, gl.TRIANGLES, this.idx.length());
  }
}

export class MeshBuilderConstructor {

  private buffers = {};
  private idx:IndexBufferBuilder;

  public buffer(name:string, arrayType:any, type:number, spacing:number, normalized:boolean=false):MeshBuilderConstructor {
    this.buffers[name] = new VertexBufferBuilder(arrayType, type, spacing, normalized, 0, 0);
    return this;
  }

  public index(idxArrayType:any, idxType:number):MeshBuilderConstructor {
    this.idx = new IndexBufferBuilder(idxArrayType, idxType);
    return this;
  }

  public build():MeshBuilder {
    return new MeshBuilder1(this.buffers, this.idx);
  }
}