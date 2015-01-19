
import GLM = require('../libs_js/glmatrix');
import MU  = require('../libs/mathutils');
import DS = require('./drawstruct');


class VertexBufferBuilder {

  private buffer:number[] = [];

  constructor(
    private arrayType:any,
    private type:number, 
    private spacing:number, 
    private normalized:boolean
  ) {}

  public push(data:number[]):void {
    for (var i = 0; i < data.length; i++)
      this.buffer.push(data[i]);
  }

  public build(gl:WebGLRenderingContext):DS.VertexBuffer {
    var bufIdx = gl.createBuffer();
    var data:ArrayBuffer = new this.arrayType(this.buffer);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufIdx);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return new VertexBufferImpl(bufIdx, this.type, this.spacing, this.normalized);
  }
}

class DynamicVertexBufferBuilder {

  private buffer:ArrayBuffer;
  private lastIdx = 0;
  private bufIdx:WebGLBuffer;

  constructor(
    private maxSize:number,
    private arrayType,
    private type:number, 
    private spacing:number, 
    private normalized:boolean
  ) {
    this.buffer = new arrayType(maxSize*spacing);
  }

  public push(data:number[]):void {
    if (this.lastIdx >= this.maxSize)
      throw new Error('MaxSize limit exceeded');
    var off = this.lastIdx*this.spacing;
    for (var i = 0; i < this.spacing; i++)
      this.buffer[off+i] = data[i];
    this.lastIdx++;
  }

  public tell():number {
    return this.lastIdx;
  }

  public goto(off:number):void {
    this.lastIdx = off;
  }

  public refresh(gl:WebGLRenderingContext):void {
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufIdx);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.buffer);
  }

  public build(gl:WebGLRenderingContext):DS.VertexBuffer {
    this.bufIdx = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ARRAY_BUFFER, this.buffer, gl.STREAM_DRAW);
    return new VertexBufferImpl(this.bufIdx, this.type, this.spacing, this.normalized);
  }
}

class VertexBufferImpl implements DS.VertexBuffer {

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

export class Mesh implements DS.DrawStruct {

  constructor(
    private material:DS.Material, 
    private vtxBuffers, 
    private idx:DS.IndexBuffer, 
    private mode:number, 
    private length:number, 
    private offset:number=0
  ) {}

  getMaterial():DS.Material {
    return this.material;
  }

  getMode():number {
    return this.mode;
  }

  getVertexBuffer(attribute:string):DS.VertexBuffer {
    return this.vtxBuffers[attribute];
  }

  getAttributes():string[] {
    return Object.keys(this.vtxBuffers);
  }

  getIndexBuffer():DS.IndexBuffer {
    return this.idx;
  }

  getVertexBuffers() {
    return this.vtxBuffers;
  }

  getLength():number {
    return this.length;
  }

  getOffset():number {
    return this.offset;
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
    this.buffer.push(idx, idx + 2, idx + 1);
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

  public buf():number[] {
    return this.buffer;
  }

  public build(gl:WebGLRenderingContext):DS.IndexBuffer {
    var bufIdx = gl.createBuffer();
    var data = new this.arrayType(this.buffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, <ArrayBuffer> data, gl.STATIC_DRAW);
    return new IndexBufferImpl(bufIdx, this.type);
  }
}

class IndexBufferImpl implements DS.IndexBuffer {

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

export class MeshBuilder {

  private attrs = {};

  constructor(
    private buffers:any, 
    private idx:IndexBufferBuilder
  ) {}

  public offset():number {
    return this.idx.length();
  }

  public goto(mark:any) {
    for (var attr in this.buffers) {
      this.buffers[attr].goto(mark[attr]);
    }
  }

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
      //noinspection JSUnfilteredForInLoop
      this.buffers[attr].push(this.attrs[attr]);
    }
    this.idx.vtx();
    return this;
  }

  public end():void {
    this.idx.setMode(NONE);
    this.attrs = {};
  }

  public idxbuf():IndexBufferBuilder {
    return this.idx;
  }

  public build(gl:WebGLRenderingContext, material:DS.Material):DS.DrawStruct {
    var bufs = {};
    for (var bufName in this.buffers) {
      //noinspection JSUnfilteredForInLoop
      bufs[bufName] = this.buffers[bufName].build(gl);
    }
    var idx = this.idx.build(gl);
    return new Mesh(material, bufs, idx, gl.TRIANGLES, this.idx.length());
  }
}

export class MeshBuilderConstructor {

  private buffers = {};
  private idx:IndexBufferBuilder;
  private size:number;

  constructor(size:number=64*1024) {
    this.size = size;
  }

  public buffer(name:string, arrayType:any, type:number, spacing:number, normalized:boolean=false):MeshBuilderConstructor {
    this.buffers[name] = new DynamicVertexBufferBuilder(this.size, arrayType, type, spacing, normalized);
    return this;
  }

  public index(idxArrayType:any, idxType:number):MeshBuilderConstructor {
    this.idx = new IndexBufferBuilder(idxArrayType, idxType);
    return this;
  }

  public build():MeshBuilder {
    return new MeshBuilder(this.buffers, this.idx);
  }
}